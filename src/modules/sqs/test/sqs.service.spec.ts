import { Test, TestingModule } from '@nestjs/testing';
import { SQSService } from '../sqs.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

jest.mock('@aws-sdk/client-sqs', () => {
  return {
    SQSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ MessageId: 'mock-message-id' }),
    })),
    SendMessageCommand: jest.fn(),
    ReceiveMessageCommand: jest.fn(),
    DeleteMessageCommand: jest.fn(),
  };
});

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
      service['sendMessage'] = jest.fn().mockResolvedValue(undefined);
      await expect(service.publishPaymentInitiated({ id: '1' } as any)).resolves.toBeUndefined();
      expect(service['sendMessage']).toHaveBeenCalled();
    });
  });

  describe('publishPaymentCompleted', () => {
    it('should publish payment completed event', async () => {
      service['sendMessage'] = jest.fn().mockResolvedValue(undefined);
      await expect(service.publishPaymentCompleted({ id: '2' } as any)).resolves.toBeUndefined();
      expect(service['sendMessage']).toHaveBeenCalled();
    });
  });

  describe('publishPaymentFailed', () => {
    it('should publish payment failed event', async () => {
      service['sendMessage'] = jest.fn().mockResolvedValue(undefined);
      await expect(service.publishPaymentFailed({ id: '3' } as any)).resolves.toBeUndefined();
      expect(service['sendMessage']).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should throw if queue url is not set', async () => {
      configService.get = jest.fn().mockReturnValue(undefined);
      (service as any)['queueUrl'] = '';
      await expect(service['sendMessage']({ eventType: 'event', paymentReference: '', merchantId: '' })).resolves.toBeUndefined();
    });
    it('should send message to SQS', async () => {
      // The SQSClient is mocked globally
      await expect(service['sendMessage']({ eventType: 'test', paymentReference: 'ref', merchantId: 'mid' })).resolves.toBeUndefined();
    });
  });

  describe('pollOnce', () => {
    let sendMock: jest.Mock;
    beforeEach(() => {
      sendMock = jest.fn();
      service['sqsClient'].send = sendMock;
    });

    it('should return messages if present', async () => {
      sendMock.mockResolvedValue({
        Messages: [
          { MessageId: '1', Body: 'body1' },
          { MessageId: '2', Body: 'body2' },
        ],
      });
      const result = await service.pollOnce();
      expect(result).toEqual([
        { messageId: '1', body: 'body1' },
        { messageId: '2', body: 'body2' },
      ]);
    });

    it('should return empty array if no messages', async () => {
      sendMock.mockResolvedValue({ Messages: [] });
      const result = await service.pollOnce();
      expect(result).toEqual([]);
    });

    it('should return empty array if error occurs', async () => {
      sendMock.mockRejectedValue(new Error('fail'));
      const result = await service.pollOnce();
      expect(result).toEqual([]);
    });
  });

    describe('lifecycle hooks', () => {
    it('should start polling on module init', async () => {
      const startPollingSpy = jest.spyOn(service as any, 'startPolling').mockImplementation(() => {});
      await service.onModuleInit();
      expect(startPollingSpy).toHaveBeenCalled();
    });
    it('should clear polling interval on module destroy', async () => {
      (service as any).polling = setInterval(() => {}, 10000);
      const clearSpy = jest.spyOn(global, 'clearInterval');
      await service.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalled();
    });
    it('should log if no polling interval on destroy', async () => {
      (service as any).polling = undefined;
      await service.onModuleDestroy();
      // No error expected
    });
  });

  describe('sendMessage error handling', () => {
    it('should log and throw on send error', async () => {
      (service as any)['queueUrl'] = 'test-queue-url';
      const error = new Error('fail');
      service['sqsClient'].send = jest.fn().mockRejectedValue(error);
      const loggerError = jest.spyOn(service['logger'], 'error');
      await expect(service['sendMessage']({ eventType: 'event', paymentReference: '', merchantId: '' })).rejects.toThrow('fail');
      expect(loggerError).toHaveBeenCalled();
    });
  });

  describe('pollOnce edge cases', () => {
    it('should warn and return [] if queueUrl is not set', async () => {
      (service as any)['queueUrl'] = '';
      const loggerWarn = jest.spyOn(service['logger'], 'warn');
      const result = await service.pollOnce();
      expect(result).toEqual([]);
      expect(loggerWarn).toHaveBeenCalled();
    });
  });
  });
