import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  Repository,
  FindOptionsWhere,
} from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ResultWithError } from '../common/interfaces';
import { GenericError } from '../common/errors/Generic.error';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class TransactionRepoService {
  private transactionRepo: Repository<Transaction>;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectEntityManager() private entitymanager: EntityManager,
  ) {
    this.transactionRepo = entitymanager.getRepository(Transaction);
  }

  // getter and setter functions

  async getAll(
    options: FindManyOptions<Transaction>,
    panic = true,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Finding transactions [condition: ${JSON.stringify(options)}]`,
      );

      const result = await this.transactionRepo.find(options);
      if (result.length === 0 && panic) {
        throw new GenericError('No transactions found!', HttpStatus.NOT_FOUND);
      }

      return { data: result, error: null };
    } catch (error) {
      this.logger.error(
        `Error in fetching transactions [condition: ${JSON.stringify(
          options,
        )}]: ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async get(
    options: FindOneOptions<Transaction>,
    panic = true,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Finding transaction record [condition : ${JSON.stringify(options)}]`,
      );
      const result = await this.transactionRepo.findOne(options);
      if (!result && panic)
        throw new GenericError('Transaction not found', HttpStatus.NOT_FOUND);
      return { data: result, error: null };
    } catch (error) {
      this.logger.error(
        `Error in fetching transaction record [condition : ${JSON.stringify(
          options,
        )}: ${error.stack}]`,
      );
      return { data: null, error: error };
    }
  }

  async create(tx: Transaction): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Creating transaction record [transaction : ${JSON.stringify(tx)}]`,
      );
      const newTransaction = new Transaction();
      newTransaction.TxHash = tx.TxHash ? tx.TxHash : null;
      newTransaction.Timestamp = tx.Timestamp;

      const createdTransaction = await this.transactionRepo.save(
        newTransaction,
      );

      this.logger.info(
        `Created a new transaction [transaction : ${createdTransaction.TxID}]`,
      );
      return { data: createdTransaction, error: null };
    } catch (error) {
      this.logger.error(
        `Error in transaction transaction record [transaction : ${JSON.stringify(
          tx,
        )}] : ${error.stack}`,
      );
      return { data: null, error: error };
    }
  }

  async update(
    criteria: FindOptionsWhere<Transaction>,
    partialEntity: QueryDeepPartialEntity<Transaction>,
  ): Promise<{ error }> {
    try {
      this.logger.info(
        `Updating transaction record [criteria: ${JSON.stringify(
          criteria,
        )}, update: ${JSON.stringify(partialEntity)}]`,
      );

      await this.transactionRepo.update(criteria, partialEntity);
      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error in updating transaction record [criteria : ${JSON.stringify(
          criteria,
        )}, partialEntity : ${JSON.stringify(partialEntity)}] : ${error.stack}`,
      );
      return { error };
    }
  }
}
