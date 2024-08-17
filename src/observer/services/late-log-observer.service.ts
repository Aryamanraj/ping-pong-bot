import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RpcService } from '../../rpc/rpc.service';
import { Logger } from 'winston';
import { Promisify } from '../../common/helpers/promisifier';
import { TransactionRepoService } from '../../repo/transaction-repo.service';
import { BASE_EVENT_DATA } from '../../common/interfaces';
import { TX_STATE_TYPE } from '../../common/constants';
import { Transaction } from '../../repo/entities/transaction.entity';

@Injectable()
export class LateLogObserverService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private rpcService: RpcService,
    private transactionRepo: TransactionRepoService,
  ) {}

  async handleLateSendPong(data: BASE_EVENT_DATA): Promise<{ error }> {
    try {
      this.logger.info(
        `Processing late send pong from logs queue [data : ${JSON.stringify(data)}]`,
      );

      const transaction = await Promisify<Transaction>(this.transactionRepo.get({where: {TxHash: data.txHash}}))
      if(transaction.TxState === TX_STATE_TYPE.PONG_CONFIRMED){
        throw new Error('pong already confirmed')
      }
      const { error } = await this.transactionRepo.update(
        { TxHash: data.txHash },
        { TxState: TX_STATE_TYPE.PONGING },
      );
      if (error) throw error;

      const { error: lateSendPongError } = await this.rpcService.handleSendPong(
        data,
      );
      if (lateSendPongError) throw lateSendPongError;

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
