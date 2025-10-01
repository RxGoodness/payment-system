import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsUUID, 
  Min, 
  IsArray,
  IsUrl,
  IsIn,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitiatePaymentDto {
  @ApiProperty({ 
    description: 'The amount to charge the customer in their local currency. For Nigerian Naira, this would be in NGN.', 
    example: 5000.00,
    minimum: 0.01
  })
  @IsNotEmpty({ message: 'Please provide a payment amount' })
  @IsNumber({}, { message: 'The amount must be a valid number' })
  @Min(0.01, { message: 'The payment amount must be greater than zero' })
  amount: number;

  @ApiProperty({ 
    description: 'The three-letter ISO currency code. Currently supports NGN (Nigerian Naira), USD (US Dollar), GHS (Ghanaian Cedi), ZAR (South African Rand), and KES (Kenyan Shilling)', 
    example: 'NGN',
    default: 'NGN'
  })
  @IsOptional()
  @IsString({ message: 'Currency code must be a valid string' })
  @IsIn(['NGN', 'USD', 'GHS', 'ZAR', 'KES'], { message: 'Please provide a supported currency code: NGN, USD, GHS, ZAR, or KES' })
  currency?: string = 'NGN';

  @ApiProperty({ 
    description: 'Payment description', 
    example: 'Payment for Order #ORD-12345'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ 
    description: 'The email address of the customer making the payment. This will be used for payment notifications and receipts.', 
    example: 'customer@example.com'
  })
  @IsNotEmpty({ message: 'Please provide the customer\'s email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  customerEmail: string;

  @ApiProperty({ 
    description: 'The full name of the customer making the payment. This will appear on their transaction records and receipts.', 
    example: 'John Doe'
  })
  @IsNotEmpty({ message: 'Please provide the customer\'s full name' })
  @IsString({ message: 'Customer name must be text' })
  customerName: string;

  @ApiProperty({ 
    description: 'Customer phone number', 
    example: '+234-801-234-5678',
    required: false
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ 
    description: 'Payment method ID from your payment methods', 
    example: 'uuid-string'
  })
  @IsNotEmpty()
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({ 
    description: 'Callback URL after payment completion', 
    required: false
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiProperty({ 
    description: 'Allowed payment channels', 
    example: ['card', 'bank', 'ussd'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @ApiProperty({ 
    description: 'Additional metadata for the payment', 
    required: false,
    example: { 
      orderId: 'ORD-12345',
      customerId: 'CUST-67890',
      invoiceNumber: 'INV-2023-001'
    }
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class PaymentCallbackDto {
  @ApiProperty({ description: 'Paystack payment reference' })
  @IsNotEmpty()
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Payment status from gateway' })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({ description: 'Transaction reference from Paystack' })
  @IsOptional()
  @IsString()
  trxref?: string;
}

export class WebhookPayloadDto {
  @ApiProperty({ description: 'Webhook event type' })
  @IsNotEmpty()
  @IsString()
  event: string;

  @ApiProperty({ description: 'Webhook event data' })
  @IsNotEmpty()
  data: any;
}

export class PaymentStatusDto {
  @ApiProperty({ description: 'Payment reference to check' })
  @IsNotEmpty()
  @IsString()
  reference: string;
}

export class PaginationDto {
  @ApiProperty({ description: 'Page number', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Min(100)
  limit?: number = 20;
}