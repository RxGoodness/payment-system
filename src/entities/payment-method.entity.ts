import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Merchant } from './merchant.entity';
import { Payment } from './payment.entity';

export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  DIGITAL_WALLET = 'digital_wallet'
}

@Entity('payment_methods')
export class PaymentMethod {
  @ApiProperty({
    description: 'The unique identifier of the payment method',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType
  })
  type: PaymentMethodType;

  @Column({ length: 255 })
  providerName: string;

  @Column({ length: 50, nullable: true })
  lastFourDigits: string;

  @Column({ length: 100, nullable: true })
  expiryMonth: string;

  @Column({ length: 100, nullable: true })
  expiryYear: string;

  @Column({ length: 255, nullable: true })
  holderName: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Merchant, (merchant: Merchant) => merchant.paymentMethods)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column()
  merchantId: string;

  @OneToMany(() => Payment, (payment: Payment) => payment.paymentMethod)
  payments: Payment[];
}