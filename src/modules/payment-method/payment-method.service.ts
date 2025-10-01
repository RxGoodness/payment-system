import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';
import { Merchant } from '../../entities/merchant.entity';

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async create(merchantId: string, createDto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const paymentMethod = this.paymentMethodRepository.create({
      ...createDto,
      merchantId,
    });

    return await this.paymentMethodRepository.save(paymentMethod);
  }

  async findAll(merchantId: string): Promise<PaymentMethod[]> {
    return await this.paymentMethodRepository.find({
      where: { merchantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, merchantId: string): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id, merchantId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return paymentMethod;
  }

  async update(id: string, merchantId: string, updateDto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const paymentMethod = await this.findOne(id, merchantId);

    Object.assign(paymentMethod, updateDto);
    return await this.paymentMethodRepository.save(paymentMethod);
  }

  async remove(id: string, merchantId: string): Promise<void> {
    const paymentMethod = await this.findOne(id, merchantId);
    
    // Soft delete by setting isActive to false
    paymentMethod.isActive = false;
    await this.paymentMethodRepository.save(paymentMethod);
  }

  async validateOwnership(paymentMethodId: string, merchantId: string): Promise<boolean> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId, isActive: true },
    });

    if (!paymentMethod) {
      throw new UnauthorizedException('Payment method not found or not authorized');
    }

    return true;
  }
}