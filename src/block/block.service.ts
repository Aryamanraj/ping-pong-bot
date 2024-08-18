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
import { Transaction } from '../repo/entities/transaction.entity';
import { Promisify } from '../common/helpers/promisifier';
import {
  GetNewTransactionsResult,
  NEW_PINGER_EVENT_DATA,
  PingEventData,
  PONG_EVENT_DATA,
} from '../common/interfaces';

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
    private transactionRepo: TransactionRepoService,
    private rpcService: RpcService,
  ) {
    this.limit = 1000;
  }

  async onApplicationBootstrap() {
    const defaultConfig = ONCHAIN_CONFIG;
    this.env = (this.configService.get('NODE_ENV') ||
      'development') as keyof typeof defaultConfig;

    this.contractAddress = defaultConfig[this.env].CONTRACT_ADDRESS;

    this.chain = defaultConfig[this.env].CHAIN;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async indexBlocks() {
    try {
      if (this.isBlockIndexing) {
        this.logger.info(
          '[Block] Already indexing the blocks... Sleeping for 30 seconds',
        );
        return;
      }
      this.logger.info(
        `[Block] Indexing blocks on ${this.chain} chain, on contract addresses: ${this.contractAddress}`,
      );

      this.isBlockIndexing = true;

      // get the last processed txn
      const indexedState = await Promisify<IndexedState>(
        this.idxStateRepo.get({
          where: { Network: this.chain },
        }),
      );

      this.logger.info(
        `[Block] Starting from block number ${indexedState.BlockNumber}`,
      );
      const fromBlock = indexedState.BlockNumber + 1;
      this.logger.info(
        `[Block] Fetching next transactions within ${this.limit} blocks `,
      );
      // Get new transactions from the blockchain
      const newTransactionsResult = await Promisify<GetNewTransactionsResult>(
        this.rpcService.getNewTransactions(fromBlock, this.limit),
      );

      for (const { log, parsedLog } of newTransactionsResult.parsedLogArray) {
        // If already processed, skip
        const existingTx = await Promisify<Transaction>(
          this.transactionRepo.get(
            {
              where: { TxHash: log.transactionHash },
            },
            false,
          ),
        );
        if (existingTx) {
          this.logger.info(
            `[Block] Transaction already processed: ${log.transactionHash}`,
          );
          continue;
        }

        // Process each event in the transaction
        this.logger.info(
          `[Block] Processing event: ${parsedLog.name}, transaction: ${log.transactionHash}`,
        );
        switch (parsedLog.name) {
          case EventTypes.PING:
            const pingEventData: PingEventData = {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.index,
            };
            if (!pingEventData.txHash) {
              throw new Error('[Block] Transaction hash is missing from the event.');
            }

            this.logger.info(
              `[Block] Received Ping event with txHash: ${
                pingEventData.txHash
              }, blockNumber: ${pingEventData.blockNumber}, logIndex: ${
                pingEventData.logIndex
              }, event log: ${JSON.stringify(
                log,
              )} and parsedLog: ${JSON.stringify(parsedLog)}`,
            );

            const { error: pingError } =
              await this.rpcService.handlePingEventUpdate(pingEventData);
            if (pingError) throw pingError;
            break;
          case EventTypes.PONG:
            const pongEventData: PONG_EVENT_DATA = {
              txHash: log.transactionHash,
              originalTxHash: parsedLog.args[0],
              timestamp: Date.now(),
              blockNumber: log.blockNumber,
              logIndex: log.index,
            };
            if (!pongEventData.txHash) {
              throw new Error('Transaction hash is missing from the event.');
            }

            this.logger.info(
              `[Block] Received Pong event with txHash: ${
                pongEventData.txHash
              }, blockNumber: ${pongEventData.blockNumber}, logIndex: ${
                pongEventData.logIndex
              }, originalTxHash: ${
                pongEventData.originalTxHash
              }, event log: ${JSON.stringify(
                log,
              )} and parsedLog: ${JSON.stringify(parsedLog)}`,
            );
            const { error: pongError } =
              await this.rpcService.handlePongEventUpdate(pongEventData);
            if (pongError) throw pongError;
            break;
          case EventTypes.NEW_PINGER:
            const newPingerEventData: NEW_PINGER_EVENT_DATA = {
              txHash: log.transactionHash,
              newPinger: parsedLog.args[0],
              timestamp: Date.now(),
              blockNumber: log.blockNumber,
              logIndex: log.index,
            };
            if (!newPingerEventData.txHash) {
              throw new Error('Transaction hash is missing from the event.');
            }

            this.logger.info(
              `[Block] Received new pinger event with txHash: ${
                newPingerEventData.txHash
              }, blockNumber: ${newPingerEventData.blockNumber}, logIndex: ${
                newPingerEventData.logIndex
              }, originalTxHash: ${
                newPingerEventData.newPinger
              }, event log: ${JSON.stringify(
                log,
              )} and parsedLog: ${JSON.stringify(parsedLog)}`,
            );
            const { error: newPingerError } =
              await this.rpcService.handleNewPingerEventUpdate(
                newPingerEventData,
              );
            if (newPingerError) throw newPingerError;
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
