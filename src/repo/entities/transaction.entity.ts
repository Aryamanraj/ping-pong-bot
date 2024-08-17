import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  TX_EVENT_TYPE,
  TX_EVENT_TYPE_ENUM,
  TX_STATE_TYPE,
  TX_STATE_TYPE_ENUM,
} from '../../common/constants';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'Transactions' })
export class Transaction extends BaseEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  TxID: number;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  TxHash: string;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  Network: string;

  @ApiProperty()
  @Column({ nullable: true })
  BlockNumber: number;

  @ApiProperty()
  @Column({ nullable: true })
  LogIndex: number;

  @ApiProperty({
    enum: TX_EVENT_TYPE_ENUM,
  })
  @Column({
    type: 'enum',
    enum: TX_EVENT_TYPE,
    default: TX_EVENT_TYPE.PING,
  })
  TxType: TX_EVENT_TYPE;

  @ApiProperty({
    enum: TX_STATE_TYPE_ENUM,
  })
  @Column({
    type: 'enum',
    enum: TX_STATE_TYPE,
    default: TX_STATE_TYPE.PINGED,
  })
  TxState: TX_STATE_TYPE;

  @ApiProperty()
  @Column({ type: 'bigint' })
  Timestamp: number;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  PongTxHash: string;

  @ApiProperty()
  @Column({ nullable: true })
  PongBlockNumber: number;

  @ApiProperty()
  @Column({ nullable: true })
  PongLogIndex: number;

  @ApiProperty()
  @Column({ type: 'bigint', nullable: true })
  PongTimestamp: number;

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
