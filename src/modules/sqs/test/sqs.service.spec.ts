import { Test, TestingModule } from '@nestjs/testing';
import { SQSService } from '../sqs.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

describe('SQSService', () => {
  let service: SQSService;
  let configService: any;

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue('test-queue-url') };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SQSService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get<SQSService>(SQSService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishPaymentInitiated', () => {
    it('should publish payment initiated event', async () => {
      service['sendMessage'] = jest.fn().mockResolvedValue({ MessageId: '1' });
      const result = await service.publishPaymentInitiated({ id: '1' } as any);
      expect(result).toHaveProperty('MessageId');
    });
  });

  describe('publishPaymentCompleted', () => {
    it('should publish payment completed event', async () => {
      service['sendMessage'] = jest.fn().mockResolvedValue({ MessageId: '2' });
      const result = await service.publishPaymentCompleted({ id: '2' } as any);
      expect(result).toHaveProperty('MessageId');
    });
  });

  describe('publishPaymentFailed', () => {
    it('should publish payment failed event', async () => {
      service['sendMessage'] = jest.fn().mockResolvedValue({ MessageId: '3' });
      const result = await service.publishPaymentFailed({ id: '3' } as any);
      expect(result).toHaveProperty('MessageId');
    });
  });

  describe('sendMessage', () => {
    it('should throw if queue url is not set', async () => {
      configService.get = jest.fn().mockReturnValue(undefined);
      await expect(service['sendMessage']('event', {})).rejects.toThrow();
    });
    it('should send message to SQS', async () => {
      service['sqs'] = { sendMessage: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ MessageId: '4' }) }) } as any;
      const result = await service['sendMessage']('event', { foo: 'bar' });
      expect(result).toHaveProperty('MessageId');
    });
  });
});
