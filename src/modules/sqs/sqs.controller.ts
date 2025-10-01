import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SQSService } from './sqs.service';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('SQS Consumer')
@Controller('sqs')
@Public()
export class SQSController {
  constructor(private readonly sqsService: SQSService) {}

  @Get('poll')
  @ApiOperation({ summary: 'Manually poll SQS for messages', description: 'Trigger a one-time poll of the payment-events queue and log event details.' })
  @ApiResponse({ status: 200, description: 'Polling completed' })
  @HttpCode(HttpStatus.OK)
  async pollQueue() {
    const result = await this.sqsService.pollOnce();
    return {
      success: true,
      data: result,
      message: 'SQS queue polled successfully',
    };
  }
}

