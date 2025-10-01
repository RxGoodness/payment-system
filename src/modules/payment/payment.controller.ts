import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  Headers,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery,
  ApiHeader
} from '@nestjs/swagger';
import { GetCurrentUserId } from '../../common/decorators/get-current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentService } from './payment.service';
import { 
  InitiatePaymentDto, 
  PaymentCallbackDto, 
  WebhookPayloadDto, 
  PaginationDto 
} from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Initialize a new payment',
    description: 'Create a new payment and get Paystack authorization URL for customer redirect'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment initialized successfully with authorization URL'
  })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async initiatePayment(
    @GetCurrentUserId() merchantId: string,
    @Body() initiatePaymentDto: InitiatePaymentDto,
  ) {
    const payment = await this.paymentService.initiatePayment(
      merchantId,
      initiatePaymentDto,
    );

    return {
      success: true,
      data: {
        paymentReference: payment.paymentReference,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        authorizationUrl: payment.authorizationUrl,
        accessCode: payment.accessCode,
        createdAt: payment.createdAt,
      },
      message: 'Payment initialized successfully. Redirect customer to authorization URL.',
    };
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Handle payment callback from Paystack',
    description: 'Process payment completion callback and verify with Paystack'
  })
  @ApiResponse({ status: 200, description: 'Payment callback processed successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async handleCallback(@Body() callbackDto: PaymentCallbackDto) {
    const payment = await this.paymentService.handleCallback(callbackDto);

    return {
      success: true,
      data: {
        paymentReference: payment.paymentReference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        processedAt: payment.processedAt,
      },
      message: 'Payment processed successfully',
    };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Handle Paystack webhook notifications',
    description: 'Process webhook events from Paystack for payment status updates'
  })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'Paystack webhook signature for verification',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Body() webhookPayload: WebhookPayloadDto,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const result = await this.paymentService.handleWebhook(webhookPayload, signature);

    return {
      success: true,
      data: result,
      message: 'Webhook processed successfully',
    };
  }

  @Get(':reference')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get payment details by reference',
    description: 'Retrieve complete payment information using payment reference'
  })
  @ApiResponse({ status: 200, description: 'Payment details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentByReference(
    @GetCurrentUserId() merchantId: string,
    @Param('reference') reference: string,
  ) {
    const payment = await this.paymentService.getPaymentByReference(
      reference,
      merchantId,
    );

    return {
      success: true,
      data: payment,
      message: 'Payment details retrieved successfully',
    };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get paginated list of merchant payments',
    description: 'Retrieve all payments for the authenticated merchant with pagination'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayments(
    @GetCurrentUserId() merchantId: string,
    @Query() pagination: PaginationDto,
  ) {
    const result = await this.paymentService.getPaymentsByMerchant(
      merchantId,
      pagination,
    );

    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'Payments retrieved successfully',
    };
  }

  @Get(':reference/verify')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Verify payment status with Paystack',
    description: 'Force verification of payment status directly with Paystack gateway'
  })
  @ApiResponse({ status: 200, description: 'Payment verification completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async verifyPayment(
    @GetCurrentUserId() merchantId: string,
    @Param('reference') reference: string,
  ) {
    const payment = await this.paymentService.verifyPaymentStatus(reference, merchantId);

    return {
      success: true,
      data: payment,
      message: 'Payment verification completed',
    };
  }
}