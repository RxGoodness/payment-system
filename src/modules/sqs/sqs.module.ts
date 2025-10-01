import { Module } from '@nestjs/common';
import { SQSService } from './sqs.service';

@Module({
  providers: [SQSService],
  exports: [SQSService],
})
export class SQSModule {}