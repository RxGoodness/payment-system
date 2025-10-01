
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { getSQSConfig } from '../../config/sqs.config';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class SQSService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SQSService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;
  private polling: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.sqsClient = new SQSClient(getSQSConfig(configService));
    this.queueUrl = this.configService.get('AWS_SQS_QUEUE_URL') || '';
  }

  // ✅ Start polling for messages when module starts
  async onModuleInit() {
    this.logger.log('Starting SQS consumer...');
    this.startPolling();
  }

  async onModuleDestroy() {
    this.logger.log('Stopping SQS consumer...');
    if (this.polling) clearInterval(this.polling);
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

  // ✅ Consumer logic
  private startPolling() {
    if (!this.queueUrl) {
      this.logger.warn('SQS Queue URL not configured, skipping consumer');
      return;
    }

    this.polling = setInterval(async () => {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 5,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const msg of response.Messages) {
            this.logger.log(`📥 Received message: ${msg.Body}`);

            // TODO: Process message body here

            if (msg.ReceiptHandle) {
              this.logger.log(`✅ Succesfully processed message: ${msg.MessageId}`);
              // await this.sqsClient.send(
              //   new DeleteMessageCommand({
              //     QueueUrl: this.queueUrl,
              //     ReceiptHandle: msg.ReceiptHandle,
              //   }),
              // );
              // this.logger.log(`✅ Deleted message: ${msg.MessageId}`);
            }
          }
        }
      } catch (err) {
        this.logger.error('Error receiving SQS messages', err.stack);
      }
    }, 10_000); // poll every 10s
  }

    // Manual polling endpoint logic
  async pollOnce(): Promise<any[]> {
    if (!this.queueUrl) {
      this.logger.warn('SQS Queue URL not configured, skipping poll');
      return [];
    }
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 5,
      });
      const response = await this.sqsClient.send(command);
      const results: { messageId: string | undefined; body: string | undefined }[] = [];
      if (response.Messages && response.Messages.length > 0) {
        for (const msg of response.Messages) {
          this.logger.log(`📥 [Manual Poll] Received message: ${msg.Body}`);
          results.push({
            messageId: msg.MessageId,
            body: msg.Body,
          });
          // Optionally delete after processing:
          // if (msg.ReceiptHandle) {
          //   await this.sqsClient.send(new DeleteMessageCommand({
          //     QueueUrl: this.queueUrl,
          //     ReceiptHandle: msg.ReceiptHandle,
          //   }));
          //   this.logger.log(`[Manual Poll] Deleted message: ${msg.MessageId}`);
          // }
        }
      }
      return results;
    } catch (err) {
      this.logger.error('[Manual Poll] Error receiving SQS messages', err.stack);
      return [];
    }
  }
}
