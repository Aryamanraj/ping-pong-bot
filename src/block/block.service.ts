import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IndexedStateRepoService } from '../repo/indexed-state-repo.service';
import { ConfigService } from '@nestjs/config';
import { EventTypes } from '../common/types';
import { ethers } from 'ethers';
import { ONCHAIN_CONFIG } from '../common/web3';
import { IndexedState } from '../repo/entities/indexed-state.entity';
import { RpcService } from '../rpc/rpc.service';
import { TransactionRepoService } from '../repo/transaction-repo.service';
import { Promisify } from '../common/helpers/promisifier';
import { GetNewTransactionsResult, ParsedLog } from '../common/interfaces';

@Injectable()
export class BlockService implements OnApplicationBootstrap {
  private isBlockIndexing = false;
  private chain: string;
  private limit: number;
  private env: string;
  private contractAddress: ethers.Addressable;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private configService: ConfigService,
    private idxStateRepo: IndexedStateRepoService,
    private transactionsRepo: TransactionRepoService,
    private rpcService: RpcService,
  ) {
    this.limit = 1000;
  }

  async onApplicationBootstrap() {
    const defaultConfig = ONCHAIN_CONFIG;
    this.env = (this.configService.get('NODE_ENV') ||
      'development') as keyof typeof defaultConfig;

    this.contractAddress = defaultConfig[this.env].contractAddress;

    this.chain = defaultConfig[this.env].CHAIN;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async indexBlocks() {
    try {
      if (this.isBlockIndexing) {
        this.logger.info(
          'Already indexing the blocks... Sleeping for 30 seconds',
        );
        return;
      }
      this.logger.info(
        `Indexing blocks on ${this.chain} chain, on contract addresses: ${this.contractAddress}`,
      );

      this.isBlockIndexing = true;

      // get the last processed txn
      const indexedState = await Promisify<IndexedState>(
        this.idxStateRepo.get({
          where: { Network: this.chain },
        }),
      );

      this.logger.info(
        `Starting from block number ${indexedState.BlockNumber}`,
      );
      const fromBlock = indexedState.BlockNumber + 1;
      this.logger.info(
        `Fetching next transactions within ${this.limit} blocks `,
      );
      // Get new transactions from the blockchain
      const newTransactionsResult = await Promisify<GetNewTransactionsResult>(
        this.rpcService.getNewTransactions(fromBlock, this.limit),
      );

      for (const { log, parsedLog } of newTransactionsResult.parsedLogArray) {
        // If already processed, skip
        const existingTx = await this.transactionsRepo.get({
          where: { TxHash: log.transactionHash },
        });
        if (existingTx) {
          this.logger.info(
            `Transaction already processed: ${log.transactionHash}`,
          );
          continue;
        }

        // Process each event in the transaction
        this.logger.info(
          `Processing event: ${parsedLog.name}, transaction: ${log.transactionHash}`,
        );
        switch (parsedLog.name) {
          case EventTypes.PING:
            console.log(parsedLog);
            //   await this.rpcService.handlePingEvent(parsedLog);
            break;
          case EventTypes.PONG:
            //   await this.rpcService.handlePongEvent(parsedLog);
            break;
          case EventTypes.NEW_PINGER:
            //   await this.rpcService.handleNewPingerEvent(parsedLog);
            break;
          default:
            this.logger.warn(`Unhandled event: ${parsedLog.name}`);
        }
      }

      // mark this as processed signature
      await this.idxStateRepo.update(
        { Network: this.chain },
        { BlockNumber: newTransactionsResult.toBlockNumber },
      );
      this.logger.info(
        `Finished indexing up to block number ${newTransactionsResult.toBlockNumber}`,
      );
    } catch (error) {
      this.logger.error(`Error in indexing blocks : ${error.stack}`);
    }

    this.isBlockIndexing = false;
  }
}
