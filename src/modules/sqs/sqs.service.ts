import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getSQSConfig } from '../../config/sqs.config';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.sqsClient = new SQSClient(getSQSConfig(configService));
    this.queueUrl = this.configService.get('AWS_SQS_QUEUE_URL') || '';
  }

  async publishPaymentInitiated(payment: Payment): Promise<void> {
    const eventData = {
      eventType: 'payment-initiated',
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      customerEmail: payment.customerEmail,
      customerName: payment.customerName,
      timestamp: new Date().toISOString(),
      metadata: {
        description: payment.description,
        paymentMethodId: payment.paymentMethodId,
      },
    };

    await this.sendMessage(eventData);
    this.logger.log(`Payment initiated event published: ${payment.paymentReference}`);
  }

  async publishPaymentCompleted(payment: Payment): Promise<void> {
    const eventData = {
      eventType: 'payment-completed',
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      customerEmail: payment.customerEmail,
      customerName: payment.customerName,
      timestamp: new Date().toISOString(),
      metadata: {
        processedAt: payment.processedAt,
        gatewayTransactionId: payment.gatewayTransactionId,
        description: payment.description,
      },
    };

    await this.sendMessage(eventData);
    this.logger.log(`Payment completed event published: ${payment.paymentReference}`);
  }

  async publishPaymentFailed(payment: Payment): Promise<void> {
    const eventData = {
      eventType: 'payment-failed',
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      customerEmail: payment.customerEmail,
      customerName: payment.customerName,
      failureReason: payment.failureReason,
      timestamp: new Date().toISOString(),
      metadata: {
        processedAt: payment.processedAt,
        description: payment.description,
      },
    };

    await this.sendMessage(eventData);
    this.logger.log(`Payment failed event published: ${payment.paymentReference}`);
  }

  private async sendMessage(eventData: any): Promise<void> {
    if (!this.queueUrl) {
      this.logger.warn('SQS Queue URL not configured, skipping message send');
      return;
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(eventData),
        MessageAttributes: {
          EventType: {
            StringValue: eventData.eventType,
            DataType: 'String',
          },
          PaymentReference: {
            StringValue: eventData.paymentReference,
            DataType: 'String',
          },
          MerchantId: {
            StringValue: eventData.merchantId,
            DataType: 'String',
          },
        },
      });

      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error('Failed to send SQS message', error.stack);
      throw error;
    }
  }
}