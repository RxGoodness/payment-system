import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodService } from '../payment-method.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethod } from '../../../entities/payment-method.entity';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodService,
        { provide: getRepositoryToken(PaymentMethod), useValue: repo },
      ],
    }).compile();
    service = module.get<PaymentMethodService>(PaymentMethodService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save payment method', async () => {
      repo.create.mockReturnValue({ id: 1 });
      repo.save.mockResolvedValue({ id: 1 });
      const result = await service.create('merchant1', { type: 'credit_card', providerName: 'VISA' } as any);
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('findAll', () => {
    it('should return all payment methods', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll('merchant1');
      expect(result.length).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('id', 'merchant1')).rejects.toThrow(NotFoundException);
    });
    it('should return payment method', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne('id', 'merchant1');
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('update', () => {
    it('should update and save payment method', async () => {
      service.findOne = jest.fn().mockResolvedValue({ id: 1 });
      repo.save.mockResolvedValue({ id: 1, providerName: 'VISA' });
      const result = await service.update('id', 'merchant1', { providerName: 'VISA' } as any);
      expect(result).toHaveProperty('providerName', 'VISA');
    });
  });

  describe('remove', () => {
    it('should set isActive to false', async () => {
      service.findOne = jest.fn().mockResolvedValue({ id: 1, isActive: true });
      repo.save.mockResolvedValue({ id: 1, isActive: false });
      await expect(service.remove('id', 'merchant1')).resolves.toBeUndefined();
    });
  });

  describe('validateOwnership', () => {
    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.validateOwnership('id', 'merchant1')).rejects.toThrow(UnauthorizedException);
    });
    it('should return true if found', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      await expect(service.validateOwnership('id', 'merchant1')).resolves.toBe(true);
    });
  });
});
