import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Merchant } from '../../entities/merchant.entity';
import { CreateMerchantDto, LoginMerchantDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly jwtService: JwtService,
  ) {}

  async register(createMerchantDto: CreateMerchantDto): Promise<{ merchant: Partial<Merchant>; token: string }> {
    const { password, ...merchantData } = createMerchantDto;
    
    // Check if merchant already exists
    const existingMerchant = await this.merchantRepository.findOne({
      where: [
        { email: createMerchantDto.email },
        { merchantCode: createMerchantDto.merchantCode }
      ]
    });

    if (existingMerchant) {
      throw new UnauthorizedException('Merchant with this email or merchant code already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create merchant
    const merchant = this.merchantRepository.create({
      ...merchantData,
      password: hashedPassword,
    });

    const savedMerchant = await this.merchantRepository.save(merchant);

    // Generate JWT token
    const token = await this.generateToken(savedMerchant);

    // Remove password from response
    const { password: _, ...merchantWithoutPassword } = savedMerchant;

    return { merchant: merchantWithoutPassword, token };
  }

  async login(loginDto: LoginMerchantDto): Promise<{ merchant: Partial<Merchant>; token: string }> {
    const { email, password } = loginDto;

    // Find merchant by email
    const merchant = await this.merchantRepository.findOne({
      where: { email, isActive: true },
    });

    if (!merchant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, merchant.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = await this.generateToken(merchant);

    // Remove password from response
    const { password: _, ...merchantWithoutPassword } = merchant;

    return { merchant: merchantWithoutPassword, token };
  }

  async validateMerchant(merchantId: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId, isActive: true },
    });

    if (!merchant) {
      throw new UnauthorizedException('Merchant not found or inactive');
    }

    return merchant;
  }

  private async generateToken(merchant: Merchant): Promise<string> {
    const payload = {
      sub: merchant.id,
      email: merchant.email,
      merchantCode: merchant.merchantCode,
      iat: Math.floor(Date.now() / 1000),
    };

    return this.jwtService.sign(payload);
  }
}