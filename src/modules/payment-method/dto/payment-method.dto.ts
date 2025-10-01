import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { PaymentMethodType } from '../../../entities/payment-method.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({
    enum: PaymentMethodType,
    description: 'Type of payment method'
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({
    description: 'Name of the payment provider (e.g., VISA, Mastercard)',
    example: 'VISA'
  })
  @IsString()
  providerName: string;

  @ApiPropertyOptional({
    description: 'Last four digits of the card/account',
    example: '4242'
  })
  @IsString()
  @IsOptional()
  lastFourDigits?: string;

  @ApiPropertyOptional({
    description: 'Card expiry month',
    example: '12'
  })
  @IsString()
  @IsOptional()
  expiryMonth?: string;

  @ApiPropertyOptional({
    description: 'Card expiry year',
    example: '2025'
  })
  @IsString()
  @IsOptional()
  expiryYear?: string;

  @ApiPropertyOptional({
    description: 'Name of the card/account holder',
    example: 'John Doe'
  })
  @IsString()
  @IsOptional()
  holderName?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment method',
    example: {
      brand: 'Visa',
      country: 'NG',
      isDefault: true
    }
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({
    description: 'Status of the payment method',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Name of the card/account holder',
    example: 'John Doe'
  })
  @IsString()
  @IsOptional()
  holderName?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment method',
    example: {
      isDefault: true
    }
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}