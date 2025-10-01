import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentMethod } from './payment-method.entity';

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 100, unique: true })
  merchantCode: string;

  @Column({ length: 255, nullable: true })
  webhookUrl: string;

  @Column({ length: 255, nullable: true })
  webhookSecret: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Payment, (payment: Payment) => payment.merchant)
  payments: Payment[];

  @OneToMany(() => PaymentMethod, (paymentMethod: PaymentMethod) => paymentMethod.merchant)
  paymentMethods: PaymentMethod[];
}