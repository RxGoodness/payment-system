import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({ 
    description: 'Merchant business name', 
    example: 'Acme Corporation Ltd' 
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Merchant business email', 
    example: 'admin@acme.com' 
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Strong password with minimum 8 characters', 
    example: 'SecurePassword123!' 
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Password must contain uppercase, lowercase, number and special character' }
  )
  password: string;

  @ApiProperty({ 
    description: 'Unique merchant identifier code', 
    example: 'ACME001' 
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9]{3,10}$/, { 
    message: 'Merchant code must be 3-10 characters, uppercase letters and numbers only' 
  })
  merchantCode: string;

  @ApiProperty({ 
    description: 'Webhook URL for payment notifications', 
    required: false,
    example: 'https://acme.com/webhooks/payments'
  })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiProperty({ 
    description: 'Business phone number', 
    required: false,
    example: '+234-801-234-5678'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ 
    description: 'Business address', 
    required: false,
    example: '123 Business District, Lagos, Nigeria'
  })
  @IsOptional()
  @IsString()
  address?: string;
}

export class LoginMerchantDto {
  @ApiProperty({ 
    description: 'Merchant email address', 
    example: 'admin@acme.com' 
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Merchant password', 
    example: 'SecurePassword123!' 
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Authentication success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Authentication data' })
  data: {
    merchant: Partial<{
      id: string;
      name: string;
      email: string;
      merchantCode: string;
      webhookUrl?: string;
      phone?: string;
      address?: string;
      isActive: boolean;
      createdAt: Date;
    }>;
    token: string;
  };
}