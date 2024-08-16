import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RpcService } from '../../rpc/rpc.service';
import { Logger } from 'winston';
import { Promisify } from '../../common/helpers/promisifier';
import { TransactionRepoService } from '../../repo/transaction-repo.service';
import { BASE_EVENT_DATA } from '../../common/interfaces';

@Injectable()
export class LogObserverService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private rpcService: RpcService,
    private transactionRepo: TransactionRepoService,
  ) {}

  async handleSendPong(data: BASE_EVENT_DATA): Promise<{ error }> {
    try {
      this.logger.info(
        `Processing send pong from logs queue [data : ${JSON.stringify(
          data,
        )}]`,
      );

      const { error } = await this.rpcService.handleSendPong(data);
      if (error) throw error;

      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error in processing withdraw event from logs queue [data : ${JSON.stringify(
          data,
        )}] : ${error.stack}`,
      );
      return { error };
    }
  }
}
