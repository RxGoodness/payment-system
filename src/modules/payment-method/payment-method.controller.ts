import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentMethodService } from './payment-method.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethod } from '../../entities/payment-method.entity';

@ApiTags('Payment Methods')
@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payment method' })
  @ApiResponse({
    status: 201,
    description: 'The payment method has been successfully created.',
    type: PaymentMethod
  })
  async create(
    @Request() req,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto
  ): Promise<PaymentMethod> {
    return await this.paymentMethodService.create(req.user.id, createPaymentMethodDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payment methods for the authenticated merchant' })
  @ApiResponse({
    status: 200,
    description: 'List of payment methods',
    type: [PaymentMethod]
  })
  async findAll(@Request() req): Promise<PaymentMethod[]> {
    return await this.paymentMethodService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payment method' })
  @ApiResponse({
    status: 200,
    description: 'The payment method details',
    type: PaymentMethod
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async findOne(@Request() req, @Param('id') id: string): Promise<PaymentMethod> {
    return await this.paymentMethodService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a payment method' })
  @ApiResponse({
    status: 200,
    description: 'The payment method has been successfully updated.',
    type: PaymentMethod
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto
  ): Promise<PaymentMethod> {
    return await this.paymentMethodService.update(id, req.user.id, updatePaymentMethodDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payment method' })
  @ApiResponse({ status: 200, description: 'The payment method has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async remove(@Request() req, @Param('id') id: string): Promise<void> {
    return await this.paymentMethodService.remove(id, req.user.id);
  }
}