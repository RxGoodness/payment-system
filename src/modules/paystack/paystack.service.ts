import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import {
  PaymentGateway,
  PaymentInitializationData,
  PaymentVerificationResponse,
  WebhookProcessingResult,
  PaymentGatewayResponse,
} from '../../common/interfaces/payment-gateway.interface';

@Injectable()
export class PaystackService implements PaymentGateway {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('PAYSTACK_PUBLIC_KEY') || '';
    this.webhookSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';

    if (!this.secretKey || !this.publicKey) {
      this.logger.error('Paystack credentials not configured properly');
    }
  }

  async initializePayment(data: PaymentInitializationData): Promise<PaymentGatewayResponse> {
    try {
      const payload = {
        email: data.email,
        amount: Math.round(data.amount * 100), // Convert to kobo
        currency: data.currency || 'NGN',
        reference: data.reference,
        callback_url: data.callbackUrl,
        metadata: data.metadata,
        channels: data.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
        custom_fields: data.customFields,
      };

      const response = await this.makeRequest('POST', '/transaction/initialize', payload);

      if (response.status) {
        return {
          status: true,
          message: response.message,
          data: {
            authorization_url: response.data.authorization_url,
            access_code: response.data.access_code,
            reference: response.data.reference,
          },
        };
      }

      throw new BadRequestException(response.message || 'Failed to initialize payment');
    } catch (error) {
      this.logger.error('Payment initialization failed:', error);
      throw new BadRequestException('Payment initialization failed');
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      const response = await this.makeRequest('GET', `/transaction/verify/${reference}`);

      if (response.status) {
        return {
          status: true,
          message: response.message,
          data: {
            reference: response.data.reference,
            amount: response.data.amount / 100, // Convert from kobo
            currency: response.data.currency,
            status: response.data.status,
            gateway_response: response.data.gateway_response,
            paid_at: response.data.paid_at,
            created_at: response.data.created_at,
            channel: response.data.channel,
            authorization: response.data.authorization,
            customer: response.data.customer,
          },
        };
      }

      throw new BadRequestException(response.message || 'Payment verification failed');
    } catch (error) {
      this.logger.error('Payment verification failed:', error);
      throw new BadRequestException('Payment verification failed');
    }
  }

  /**
   * Validates Paystack webhook using improved signature logic (raw body string) and optional IP check.
   * Accepts either (payload, signature, rawBodyStr?, requestIp?) for compatibility.
   */
  async processWebhook(
    payload: any,
    signature: string,
    rawBodyStr?: string,
    requestIp?: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Optional: IP address validation if provided
      if (requestIp) {
        const trustedIps = ['52.31.139.75', '52.49.173.169', '52.214.14.220'];
        this.logger.log('Request IP:', requestIp);
        if (!trustedIps.includes(requestIp)) {
          this.logger.warn('Unauthorized IP:', requestIp);
          return {
            isValid: false,
            event: '',
            data: null,
          };
        }
        this.logger.log('IP check passed');
      }

      // Use rawBodyStr for signature validation if provided, else fallback to JSON.stringify(payload)
      const bodyString = rawBodyStr || JSON.stringify(payload);
      const computedHash = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(bodyString)
        .digest('hex');

      this.logger.log('Computed Hash:', computedHash);
      this.logger.log('Received Signature:', signature);

      if (computedHash !== signature) {
        this.logger.warn('Invalid webhook signature');
        return {
          isValid: false,
          event: '',
          data: null,
        };
      }

      return {
        isValid: true,
        event: payload.event,
        data: payload.data,
      };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      return {
        isValid: false,
        event: '',
        data: null,
      };
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data && (method === 'POST' || method === 'PUT')) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Helper method to generate reference
  generateReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${random}`.toUpperCase();
  }

  // Get supported banks for bank transfer
  async getBanks(): Promise<any> {
    try {
      return await this.makeRequest('GET', '/bank');
    } catch (error) {
      this.logger.error('Failed to fetch banks:', error);
      throw new BadRequestException('Failed to fetch banks');
    }
  }

  // Resolve account number
  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<any> {
    try {
      return await this.makeRequest('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
    } catch (error) {
      this.logger.error('Failed to resolve account:', error);
      throw new BadRequestException('Failed to resolve account number');
    }
  }
}