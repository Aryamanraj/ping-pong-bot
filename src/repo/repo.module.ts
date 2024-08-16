import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionRepoService } from './transaction-repo.service';
import { IndexedStateRepoService } from './indexed-state-repo.service';
import { IndexedState } from './entities/indexed-state.entity';

export const entities = [
  Transaction,
  IndexedState,
];

export const repoServices = [
  TransactionRepoService,
  IndexedStateRepoService,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: repoServices,
  exports: repoServices,
})
export class RepoModule {}
