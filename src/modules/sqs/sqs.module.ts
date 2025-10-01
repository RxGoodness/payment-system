import { Module } from '@nestjs/common';
import { SQSService } from './sqs.service';
import { SQSController } from './sqs.controller';

@Module({
  providers: [SQSService],
  controllers: [SQSController],
  exports: [SQSService],
})
export class SQSModule {}