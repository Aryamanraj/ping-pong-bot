import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EntityManager,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { IndexedState } from './entities/indexed-state.entity';
import { ResultWithError } from '../common/interfaces';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { GenericError } from '../common/errors/Generic.error';

@Injectable()
export class IndexedStateRepoService {
  private indexedStateRepo: Repository<IndexedState>;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectEntityManager() private entitymanager: EntityManager,
  ) {
    this.indexedStateRepo = entitymanager.getRepository(IndexedState);
  }

  // getter and setter functions

  async get(
    optons: FindOneOptions<IndexedState>,
    panic = true,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Finding last indexed state record [condition : ${JSON.stringify(
          optons,
        )}]`,
      );

      const result = await this.indexedStateRepo.findOne(optons);
      if (!result && panic)
        throw new GenericError(`Indexed state not found`, HttpStatus.NOT_FOUND);
      return { data: result, error: null };
    } catch (error) {
      this.logger.error(
        `Error in fethcing indexed state [condition : ${JSON.stringify(
          optons,
        )}] : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async create(idxState: IndexedState): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Creating indexed state record [data : ${JSON.stringify(idxState)}]`,
      );

      const newIndexedState = new IndexedState();
      newIndexedState.Network = idxState.Network;
      newIndexedState.BlockNumber = idxState.BlockNumber;
      newIndexedState.ContractAddress = idxState.ContractAddress;

      const createdIndexedState = await this.indexedStateRepo.save(
        newIndexedState,
      );

      return { data: createdIndexedState, error: null };
    } catch (error) {
      this.logger.error(
        `Error in creating indexed state [data : ${JSON.stringify(
          idxState,
        )}] : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async update(
    criteria: FindOptionsWhere<IndexedState>,
    partialEntity: QueryDeepPartialEntity<IndexedState>,
  ): Promise<{ error }> {
    try {
      this.logger.info(
        `Updating last indexed state [criteria: ${JSON.stringify(
          criteria,
        )}, update: ${JSON.stringify(partialEntity)}]`,
      );

      await this.indexedStateRepo.update(criteria, partialEntity);
      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error in updating last indexed state [criteria : ${JSON.stringify(
          criteria,
        )}, partialEntity : ${JSON.stringify(partialEntity)}] : ${error.stack}`,
      );
      return { error };
    }
  }
}
