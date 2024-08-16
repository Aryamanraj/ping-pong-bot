import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IndexedStateDto } from './dto/indexed-state.dto';
import { Logger } from 'winston';
import { ResultWithError } from '../common/interfaces';
import { IndexedStateRepoService } from '../repo/indexed-state-repo.service';
import { IndexedState } from '../repo/entities/indexed-state.entity';
import { Promisify } from '../common/helpers/promisifier';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QueueNames, QUEUE_JOB_NAMES } from '../common/constants';

@Injectable()
export class AdminService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectQueue(QueueNames.NEW_LOGS) private logsQueue: Queue,
    private idxStateRepo: IndexedStateRepoService,
  ) {}

  async handleIndexedState(
    indexedState: IndexedStateDto,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Updating last indexed state [data : ${JSON.stringify(indexedState)}]`,
      );
      // check if it exist
      let lastIndexedState = await Promisify<IndexedState>(
        this.idxStateRepo.get(
          {
            where: { Network: indexedState.network },
          },
          false,
        ),
      );

      let _error;

      if (!lastIndexedState) {
        lastIndexedState = new IndexedState();

        lastIndexedState.Network = indexedState.network;
        lastIndexedState.BlockNumber = indexedState.blockNumber;

        const { error } = await this.idxStateRepo.create(lastIndexedState);
        _error = error;
      } else {
        // update it
        lastIndexedState.BlockNumber = indexedState.blockNumber
          ? indexedState.blockNumber
          : lastIndexedState.BlockNumber;
        const { error } = await this.idxStateRepo.update(
          { Network: indexedState.network },
          lastIndexedState,
        );
        _error = error;
      }

      if (_error) throw _error;

      this.logger.info(`Updated last indexed state !`);
      return { data: 'success', error: null };
    } catch (error) {
      this.logger.error(
        `Error in setting last indexed state [data : ${JSON.stringify(
          indexedState,
        )}] : ${error.stack}`,
      );
      return { data: null, error };
    }
  }
}
