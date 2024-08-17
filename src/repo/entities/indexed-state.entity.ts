import { ApiProperty } from '@nestjs/swagger';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'IndexedState' })
export class IndexedState extends BaseEntity {
  @ApiProperty()
  @Column({ primary: true, nullable: false })
  Network: string;

  @ApiProperty()
  @Column({ nullable: true })
  BlockNumber: number;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  ContractAddress: string;

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
