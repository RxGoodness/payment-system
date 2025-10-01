import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { PaystackService } from '../paystack/paystack.service';
import { SQSService } from '../sqs/sqs.service';
import { InitiatePaymentDto, PaymentCallbackDto, WebhookPayloadDto, PaginationDto } from './dto/payment.dto';
import { PaginatedResponse } from '../../common/interfaces/api.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly paystackService: PaystackService,
    private readonly sqsService: SQSService,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(
    merchantId: string,
    initiatePaymentDto: InitiatePaymentDto,
  ): Promise<Payment & { authorizationUrl: string; accessCode: string }> {
    const { paymentMethodId, ...paymentData } = initiatePaymentDto;

    // Validate payment method belongs to merchant
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found or inactive');
    }

    // Generate unique payment reference
    const paymentReference = this.paystackService.generateReference('PAY');

    // Create payment record
    const payment = this.paymentRepository.create({
      ...paymentData,
      paymentReference,
      merchantId,
      paymentMethodId,
      status: PaymentStatus.PENDING,
      currency: paymentData.currency || 'NGN',
    });

    const savedPayment = await this.paymentRepository.save(payment);

    try {
      // Initialize payment with Paystack
      const paystackResponse = await this.paystackService.initializePayment({
        email: paymentData.customerEmail,
        amount: paymentData.amount,
        currency: paymentData.currency || 'NGN',
        reference: paymentReference,
        callbackUrl: paymentData.callbackUrl || `${this.configService.get('APP_URL')}/payments/callback`,
        metadata: {
          ...paymentData.metadata,
          merchantId,
          paymentId: savedPayment.id,
          customerName: paymentData.customerName,
          customerPhone: paymentData.customerPhone,
        },
        channels: paymentData.channels,
      });

      // Update payment with Paystack details
      await this.paymentRepository.update(savedPayment.id, {
        gatewayResponse: paystackResponse as any,
      });

      // Publish payment initiated event to SQS
      try {
        await this.sqsService.publishPaymentInitiated(savedPayment);
      } catch (error) {
        this.logger.error('Failed to publish payment initiated event', error.stack);
        // Don't fail the payment initiation if SQS fails
      }

      return {
        ...savedPayment,
        authorizationUrl: paystackResponse.data?.authorization_url || '',
        accessCode: paystackResponse.data?.access_code || '',
      };
    } catch (error) {
      // Update payment status to failed
      await this.paymentRepository.update(savedPayment.id, {
        status: PaymentStatus.FAILED,
        failureReason: error.message,
      });

      this.logger.error('Payment initialization failed:', error);
      throw new BadRequestException('Failed to initialize payment with gateway');
    }
  }

  async handleCallback(callbackDto: PaymentCallbackDto): Promise<Payment> {
    const { reference } = callbackDto;

    // Find payment by reference
    const payment = await this.paymentRepository.findOne({
      where: { paymentReference: reference },
      relations: ['merchant', 'paymentMethod'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify payment with Paystack
    try {
      const verificationResponse = await this.paystackService.verifyPayment(reference);
      
      const status = this.mapPaystackStatus(verificationResponse.data.status);
      
      const updateData: Partial<Payment> = {
        status,
        gatewayTransactionId: verificationResponse.data.reference,
        gatewayResponse: verificationResponse.data,
      };

      if (status === PaymentStatus.COMPLETED || status === PaymentStatus.FAILED) {
        updateData.processedAt = new Date();
      }

      await this.paymentRepository.update(payment.id, updateData);

      // Fetch updated payment
      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['merchant', 'paymentMethod'],
      });

      if (!updatedPayment) {
        throw new NotFoundException('Updated payment not found');
      }

      // Publish appropriate event to SQS
      try {
        if (status === PaymentStatus.COMPLETED) {
          await this.sqsService.publishPaymentCompleted(updatedPayment);
        } else if (status === PaymentStatus.FAILED) {
          await this.sqsService.publishPaymentFailed(updatedPayment);
        }
      } catch (error) {
        this.logger.error('Failed to publish payment status event', error.stack);
      }

      return updatedPayment;
    } catch (error) {
      this.logger.error('Payment verification failed:', error);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async handleWebhook(
    webhookPayload: WebhookPayloadDto,
    signature: string,
    rawBodyStr?: string,
    requestIp?: string
  ): Promise<any> {
    // Process webhook with Paystack service (now with raw body and IP validation)
    const webhookResult = await this.paystackService.processWebhook(
      webhookPayload,
      signature,
      rawBodyStr,
      requestIp
    );

    if (!webhookResult.isValid) {
      throw new BadRequestException('Invalid webhook signature or IP');
    }

    const { event, data } = webhookResult;

    // Handle different webhook events
    switch (event) {
      case 'charge.success':
        return this.handleChargeSuccess(data);
      case 'charge.failed':
        return this.handleChargeFailed(data);
      default:
        this.logger.log(`Unhandled webhook event: ${event}`);
        return { message: 'Webhook received' };
    }
  }

  async getPaymentByReference(paymentReference: string, merchantId?: string): Promise<Payment> {
    const whereCondition: any = { paymentReference };
    if (merchantId) {
      whereCondition.merchantId = merchantId;
    }

    const payment = await this.paymentRepository.findOne({
      where: whereCondition,
      relations: ['merchant', 'paymentMethod'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getPaymentsByMerchant(
    merchantId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Payment>> {
    const { page = 1, limit = 20 } = pagination;
    
    const [payments, total] = await this.paymentRepository.findAndCount({
      where: { merchantId },
      relations: ['paymentMethod'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async handleChargeSuccess(data: any): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentReference: data.reference },
      relations: ['merchant', 'paymentMethod'],
    });

    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.COMPLETED,
        processedAt: new Date(),
        gatewayResponse: data,
      });

      // Publish event
      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['merchant', 'paymentMethod'],
      });

      if (updatedPayment) {
        await this.sqsService.publishPaymentCompleted(updatedPayment);
      }
    }
  }

  private async handleChargeFailed(data: any): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentReference: data.reference },
      relations: ['merchant', 'paymentMethod'],
    });

    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        processedAt: new Date(),
        failureReason: data.gateway_response || 'Payment failed',
        gatewayResponse: data,
      });

      // Publish event
      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['merchant', 'paymentMethod'],
      });

      if (updatedPayment) {
        await this.sqsService.publishPaymentFailed(updatedPayment);
      }
    }
  }

  async verifyPaymentStatus(reference: string, merchantId?: string): Promise<Payment> {
    // Find payment in database
    const payment = await this.getPaymentByReference(reference, merchantId);

    try {
      // Verify with Paystack
      const verificationResponse = await this.paystackService.verifyPayment(reference);
      
      const status = this.mapPaystackStatus(verificationResponse.data.status);
      
      // Update payment if status changed
      if (payment.status !== status) {
        const updateData: Partial<Payment> = {
          status,
          gatewayResponse: verificationResponse.data,
        };

        if (status === PaymentStatus.COMPLETED || status === PaymentStatus.FAILED) {
          updateData.processedAt = new Date();
        }

        await this.paymentRepository.update(payment.id, updateData);

        // Publish appropriate event
        const updatedPayment = await this.paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['merchant', 'paymentMethod'],
        });

        if (updatedPayment) {
          if (status === PaymentStatus.COMPLETED) {
            await this.sqsService.publishPaymentCompleted(updatedPayment);
          } else if (status === PaymentStatus.FAILED) {
            await this.sqsService.publishPaymentFailed(updatedPayment);
          }
        }

        return updatedPayment || payment;
      }

      return payment;
    } catch (error) {
      this.logger.error('Payment verification failed:', error);
      throw new BadRequestException('Failed to verify payment status');
    }
  }

  private mapPaystackStatus(paystackStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'success': PaymentStatus.COMPLETED,
      'failed': PaymentStatus.FAILED,
      'abandoned': PaymentStatus.CANCELLED,
      'pending': PaymentStatus.PENDING,
    };

    return statusMap[paystackStatus.toLowerCase()] || PaymentStatus.FAILED;
  }
}