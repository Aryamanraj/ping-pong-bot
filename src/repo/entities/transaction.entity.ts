import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TX_EVENT_TYPE, TX_EVENT_TYPE_ENUM } from '../../common/constants';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'Transactions' })
export class Transaction extends BaseEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  TxID: number;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  TxHash: string;

  @ApiProperty({
    enum: TX_EVENT_TYPE_ENUM,
  })
  @Column({
    type: 'enum',
    enum: TX_EVENT_TYPE,
    default: TX_EVENT_TYPE.PING,
  })
  RefundState: TX_EVENT_TYPE;

  @ApiProperty()
  @Column({ type: 'bigint' })
  Timestamp: number;

  @ApiProperty()
  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

}
