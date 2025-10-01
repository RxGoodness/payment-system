import { Test, TestingModule } from '@nestjs/testing';
import { PaystackService } from '../paystack.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

jest.mock('https', () => {
  return {
    request: jest.fn(),
  };
});

describe('PaystackService', () => {
  let service: PaystackService;
  let configService: any;
  let httpsMock: any;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'PAYSTACK_SECRET_KEY') return 'whsec_test';
        if (key === 'PAYSTACK_PUBLIC_KEY') return 'pk_test';
        return undefined;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaystackService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get<PaystackService>(PaystackService);
    httpsMock = require('https');
    loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReference', () => {
    it('should generate a reference with prefix', () => {
      const ref = service.generateReference('PAY');
      expect(ref.startsWith('PAY')).toBe(true);
    });
    it('should generate a reference with default prefix', () => {
      const ref = service.generateReference();
      expect(ref.startsWith('PAY')).toBe(true);
    });
  });

  describe('initializePayment', () => {
    it('should initialize payment successfully', async () => {
      const mockRes = {
        status: true,
        message: 'Success',
        data: {
          authorization_url: 'url',
          access_code: 'code',
          reference: 'ref',
        },
      };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      const data = {
        email: 'test@example.com',
        amount: 100,
        currency: 'NGN',
        reference: 'ref',
        callbackUrl: 'cb',
        metadata: {},
        channels: ['card'],
        customFields: [],
      };
      const result = await service.initializePayment(data);
      expect(result.status).toBe(true);
      expect((result as any).data.authorization_url).toBe('url');
    });

    it('should throw BadRequestException on failed response', async () => {
      const mockRes = { status: false, message: 'fail' };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      await expect(
        service.initializePayment({
          email: 'test@example.com',
          amount: 100,
        }),
      ).rejects.toThrow('Payment initialization failed');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should throw BadRequestException on request error', async () => {
      httpsMock.request.mockImplementation(() => {
        return {
          on: (event, handler) => {
            if (event === 'error') handler(new Error('fail'));
          },
          write: jest.fn(),
          end: jest.fn(),
        };
      });
      await expect(
        service.initializePayment({
          email: 'test@example.com',
          amount: 100,
        }),
      ).rejects.toThrow('Payment initialization failed');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment successfully', async () => {
      const mockRes = {
        status: true,
        message: 'Verified',
        data: {
          reference: 'ref',
          amount: 10000,
          currency: 'NGN',
          status: 'success',
          gateway_response: 'Approved',
          paid_at: 'now',
          created_at: 'now',
          channel: 'card',
          authorization: {},
          customer: {},
        },
      };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      const result = await service.verifyPayment('ref');
      expect(result.status).toBe(true);
      expect(result.data.reference).toBe('ref');
    });

    it('should throw BadRequestException on failed response', async () => {
      const mockRes = { status: false, message: 'fail' };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      await expect(service.verifyPayment('ref')).rejects.toThrow('Payment verification failed');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should throw BadRequestException on request error', async () => {
      httpsMock.request.mockImplementation(() => {
        return {
          on: (event, handler) => {
            if (event === 'error') handler(new Error('fail'));
          },
          write: jest.fn(),
          end: jest.fn(),
        };
      });
      await expect(service.verifyPayment('ref')).rejects.toThrow('Payment verification failed');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    it('should return isValid true for valid signature', async () => {
      const payload = { event: 'charge.success', data: { foo: 'bar' } };
      const rawBodyStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', 'whsec_test')
        .update(rawBodyStr)
        .digest('hex');
      const result = await service.processWebhook(payload, signature, rawBodyStr);
      expect(result.isValid).toBe(true);
      expect(result.event).toBe('charge.success');
      expect(result.data).toEqual({ foo: 'bar' });
    });

    it('should return isValid false for invalid signature', async () => {
      const payload = { event: 'charge.success', data: { foo: 'bar' } };
      const result = await service.processWebhook(payload, 'invalid');
      expect(result.isValid).toBe(false);
      expect(result.event).toBe('');
      expect(result.data).toBeNull();
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should handle error in processWebhook', async () => {
      // Force error by making webhookSecret undefined
      (service as any)['webhookSecret'] = undefined as any;
      const payload = { event: 'charge.success', data: { foo: 'bar' } };
      const result = await service.processWebhook(payload, 'sig');
      expect(result.isValid).toBe(false);
      expect(result.event).toBe('');
      expect(result.data).toBeNull();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getBanks', () => {
    it('should return banks on success', async () => {
      const mockRes = { status: true, data: [{ name: 'Bank' }] };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      const result = await service.getBanks();
      expect(result.data[0].name).toBe('Bank');
    });

    it('should throw BadRequestException on error', async () => {
      httpsMock.request.mockImplementation(() => {
        return {
          on: (event, handler) => {
            if (event === 'error') handler(new Error('fail'));
          },
          write: jest.fn(),
          end: jest.fn(),
        };
      });
      await expect(service.getBanks()).rejects.toThrow('Failed to fetch banks');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('resolveAccountNumber', () => {
    it('should return resolved account on success', async () => {
      const mockRes = { status: true, data: { account_name: 'John Doe' } };
      httpsMock.request.mockImplementation((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify(mockRes));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
      });
      const result = await service.resolveAccountNumber('1234567890', '058');
      expect(result.data.account_name).toBe('John Doe');
    });

    it('should throw BadRequestException on error', async () => {
      httpsMock.request.mockImplementation(() => {
        return {
          on: (event, handler) => {
            if (event === 'error') handler(new Error('fail'));
          },
          write: jest.fn(),
          end: jest.fn(),
        };
      });
      await expect(service.resolveAccountNumber('1234567890', '058')).rejects.toThrow('Failed to resolve account number');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });
});
