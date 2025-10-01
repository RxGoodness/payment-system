import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { Merchant } from '../../entities/merchant.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaystackModule } from '../paystack/paystack.module';
import { SQSModule } from '../sqs/sqs.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Merchant]),
    PaystackModule,
    SQSModule,
    PaymentMethodModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}