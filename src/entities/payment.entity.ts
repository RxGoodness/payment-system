import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Merchant } from './merchant.entity';
import { PaymentMethod } from './payment-method.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  paymentReference: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  status: PaymentStatus;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  customerEmail: string;

  @Column({ length: 255, nullable: true })
  customerName: string;

  @Column({ length: 255, nullable: true })
  gatewayTransactionId: string;

  @Column({ type: 'json', nullable: true })
  gatewayResponse: any;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ nullable: true })
  processedAt: Date;

  @Column({ length: 500, nullable: true })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Merchant, (merchant: Merchant) => merchant.payments)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column()
  merchantId: string;

  @ManyToOne(() => PaymentMethod, (paymentMethod: PaymentMethod) => paymentMethod.payments)
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: PaymentMethod;

  @Column()
  paymentMethodId: string;
}