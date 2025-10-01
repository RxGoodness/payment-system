import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Merchant } from '../../../entities/merchant.entity';
import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let merchantRepo: any;

  beforeEach(async () => {
    merchantRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('token'),
          },
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should login and return a token', async () => {
    merchantRepo.findOne.mockResolvedValue({ id: 1, email: 'test@test.com', password: 'hashed' });
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
    const result = await service.login({ email: 'test@test.com', password: 'password' });
    expect(result).toHaveProperty('token', 'token');
    expect(result.merchant).toHaveProperty('email', 'test@test.com');
  });

  it('should throw on invalid login', async () => {
    merchantRepo.findOne.mockResolvedValue(null);
    await expect(service.login({ email: 'bad', password: 'bad' })).rejects.toThrow();
  });

  it('should register a user', async () => {
    merchantRepo.findOne.mockResolvedValue(null); // No existing merchant
    merchantRepo.create.mockImplementation((data) => ({ ...data, id: 1 }));
    merchantRepo.save.mockResolvedValue({ id: 1, email: 'test@test.com', merchantCode: 'ACME001' });
    jest.spyOn(require('bcryptjs'), 'hash').mockResolvedValue('hashed');
    const result = await service.register({ email: 'test@test.com', password: 'Password123!', name: 'Test', merchantCode: 'ACME001' });
    expect(result.merchant).toHaveProperty('email', 'test@test.com');
    expect(result.merchant).toHaveProperty('merchantCode', 'ACME001');
  });

  // No validateUser method exists on AuthService, so this test is removed.
})
