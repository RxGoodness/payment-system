import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from '../../../entities/payment.entity';
import { PaymentMethod } from '../../../entities/payment-method.entity';
import { PaystackService } from '../../paystack/paystack.service';
import { SQSService } from '../../sqs/sqs.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: any;
  let paymentMethodRepo: any;
  let paystackService: any;
  let sqsService: any;
  let configService: any;

  beforeEach(async () => {
    paymentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };
    paymentMethodRepo = { findOne: jest.fn() };
    paystackService = {
      initializePayment: jest.fn(),
      verifyPayment: jest.fn(),
      processWebhook: jest.fn(),
      generateReference: jest.fn().mockReturnValue('PAY_123'),
    };
    sqsService = {
      publishPaymentInitiated: jest.fn(),
      publishPaymentCompleted: jest.fn(),
      publishPaymentFailed: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(PaymentMethod), useValue: paymentMethodRepo },
        { provide: PaystackService, useValue: paystackService },
        { provide: SQSService, useValue: sqsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('initiatePayment', () => {
    it('should throw if payment method not found', async () => {
      paymentMethodRepo.findOne.mockResolvedValue(null);
      await expect(
        service.initiatePayment('merchant1', { paymentMethodId: 1, amount: 1000, customerEmail: 'a', customerName: 'b' } as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and return payment with paystack details', async () => {
      paymentMethodRepo.findOne.mockResolvedValue({ id: 1 });
      paymentRepo.create.mockReturnValue({ id: 1, paymentReference: 'PAY_123' });
      paymentRepo.save.mockResolvedValue({ id: 1, paymentReference: 'PAY_123' });
      paystackService.initializePayment.mockResolvedValue({ data: { authorization_url: 'url', access_code: 'code' } });
      paymentRepo.update.mockResolvedValue({});
      sqsService.publishPaymentInitiated.mockResolvedValue({});
      const result = await service.initiatePayment('merchant1', { paymentMethodId: 1, amount: 1000, customerEmail: 'a', customerName: 'b' } as any);
      expect(result.authorizationUrl).toBe('url');
      expect(result.accessCode).toBe('code');
    });

    it('should handle paystack failure and update payment status', async () => {
      paymentMethodRepo.findOne.mockResolvedValue({ id: 1 });
      paymentRepo.create.mockReturnValue({ id: 1, paymentReference: 'PAY_123' });
      paymentRepo.save.mockResolvedValue({ id: 1, paymentReference: 'PAY_123' });
      paystackService.initializePayment.mockRejectedValue(new Error('fail'));
      paymentRepo.update.mockResolvedValue({});
      await expect(
        service.initiatePayment('merchant1', { paymentMethodId: 1, amount: 1000, customerEmail: 'a', customerName: 'b' } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleCallback', () => {
    it('should throw if payment not found', async () => {
      paymentRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.handleCallback({ reference: 'ref' } as any)).rejects.toThrow(NotFoundException);
    });
    it('should update payment and publish event', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({ id: 1, paymentReference: 'ref' });
      paystackService.verifyPayment.mockResolvedValue({ data: { status: 'success', reference: 'ref' } });
      paymentRepo.update.mockResolvedValue({});
      paymentRepo.findOne.mockResolvedValueOnce({ id: 1, paymentReference: 'ref' });
      sqsService.publishPaymentCompleted.mockResolvedValue({});
      const result = await service.handleCallback({ reference: 'ref' } as any);
      expect(result).toBeDefined();
    });
    it('should handle paystack verification failure', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({ id: 1, paymentReference: 'ref' });
      paystackService.verifyPayment.mockRejectedValue(new Error('fail'));
      await expect(service.handleCallback({ reference: 'ref' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('should throw on invalid signature', async () => {
      paystackService.processWebhook.mockResolvedValue({ isValid: false });
      await expect(service.handleWebhook({} as any, 'sig')).rejects.toThrow(BadRequestException);
    });
    it('should handle charge.success event', async () => {
      paystackService.processWebhook.mockResolvedValue({ isValid: true, event: 'charge.success', data: { reference: 'ref' } });
      paymentRepo.findOne.mockResolvedValue({ id: 1, paymentReference: 'ref' });
      paymentRepo.update.mockResolvedValue({});
      paymentRepo.findOne.mockResolvedValue({ id: 1, paymentReference: 'ref' });
      sqsService.publishPaymentCompleted.mockResolvedValue({});
      const result = await service.handleWebhook({} as any, 'sig');
      expect(result).toBeUndefined();
    });
    it('should handle charge.failed event', async () => {
      paystackService.processWebhook.mockResolvedValue({ isValid: true, event: 'charge.failed', data: { reference: 'ref' } });
      paymentRepo.findOne.mockResolvedValue({ id: 1, paymentReference: 'ref' });
      paymentRepo.update.mockResolvedValue({});
      paymentRepo.findOne.mockResolvedValue({ id: 1, paymentReference: 'ref' });
      sqsService.publishPaymentFailed.mockResolvedValue({});
      const result = await service.handleWebhook({} as any, 'sig');
      expect(result).toBeUndefined();
    });
    it('should handle unhandled event', async () => {
      paystackService.processWebhook.mockResolvedValue({ isValid: true, event: 'other', data: {} });
      const result = await service.handleWebhook({} as any, 'sig');
      expect(result).toHaveProperty('message');
    });
  });

  describe('getPaymentByReference', () => {
    it('should throw if not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.getPaymentByReference('ref')).rejects.toThrow(NotFoundException);
    });
    it('should return payment', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.getPaymentByReference('ref');
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('getPaymentsByMerchant', () => {
    it('should return paginated payments', async () => {
      paymentRepo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const result = await service.getPaymentsByMerchant('merchant1', { page: 1, limit: 10 });
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('verifyPaymentStatus', () => {
    it('should update status if changed', async () => {
      service.getPaymentByReference = jest.fn().mockResolvedValue({ id: 1, status: PaymentStatus.PENDING });
      paystackService.verifyPayment.mockResolvedValue({ data: { status: 'success' } });
      paymentRepo.update.mockResolvedValue({});
      paymentRepo.findOne.mockResolvedValue({ id: 1, status: PaymentStatus.COMPLETED });
      sqsService.publishPaymentCompleted.mockResolvedValue({});
      const result = await service.verifyPaymentStatus('ref');
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });
    it('should return payment if status not changed', async () => {
      service.getPaymentByReference = jest.fn().mockResolvedValue({ id: 1, status: PaymentStatus.COMPLETED });
      paystackService.verifyPayment.mockResolvedValue({ data: { status: 'success' } });
      const result = await service.verifyPaymentStatus('ref');
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });
    it('should throw on paystack error', async () => {
      service.getPaymentByReference = jest.fn().mockResolvedValue({ id: 1, status: PaymentStatus.PENDING });
      paystackService.verifyPayment.mockRejectedValue(new Error('fail'));
      await expect(service.verifyPaymentStatus('ref')).rejects.toThrow(BadRequestException);
    });
  });

  describe('mapPaystackStatus', () => {
    it('should map statuses correctly', () => {
      expect(service['mapPaystackStatus']('success')).toBe(PaymentStatus.COMPLETED);
      expect(service['mapPaystackStatus']('failed')).toBe(PaymentStatus.FAILED);
      expect(service['mapPaystackStatus']('abandoned')).toBe(PaymentStatus.CANCELLED);
      expect(service['mapPaystackStatus']('pending')).toBe(PaymentStatus.PENDING);
      expect(service['mapPaystackStatus']('unknown')).toBe(PaymentStatus.FAILED);
    });
  });
});
