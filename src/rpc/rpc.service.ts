/* eslint-disable @typescript-eslint/no-unused-vars */
import { InjectQueue } from '@nestjs/bull';
import {
  HttpStatus,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EVENT_TYPE, EventTypes, TransactionTypes } from '../common/types';
import { QUEUE_JOB_NAMES, QueueNames } from '../common/constants';
import { Logger } from 'winston';

import { Promisify } from '../common/helpers/promisifier';
import { Raw } from 'typeorm';
import { TransactionRepoService } from '../repo/transaction-repo.service';
import { Transaction } from '../repo/entities/transaction.entity';
import { GenericError } from '../common/errors/Generic.error';
import { ONCHAIN_CONFIG } from '../common/web3';
import {
  BASE_EVENT_DATA,
  GetNewTransactionsResult,
  NEW_PINGER_EVENT_DATA,
  ParsedLog,
  PingEvent,
  PONG_EVENT_DATA,
  ResultWithError,
} from '../common/interfaces';
import PingPongABI from './abi/PingPong.json';
import { ethers } from 'ethers';

@Injectable()
export class RpcService implements OnApplicationBootstrap {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private contractAddress: ethers.Addressable;
  private pingPongABI: ethers.Interface;
  private env: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectQueue(QueueNames.NEW_LOGS) private logsQueue: Queue,
    private configService: ConfigService,
    private transactionRepo: TransactionRepoService,
  ) {}

  async onApplicationBootstrap() {
    const defaultConfig = ONCHAIN_CONFIG;
    this.env = (this.configService.get('NODE_ENV') ||
      'development') as keyof typeof defaultConfig;
    this.initializeConfig(defaultConfig);
    await this.initConnection();
    if (this.env !== 'test') this.subscribeToEvents();
  }

  private initializeConfig(defaultConfig) {
    const _nodeUrl = this.configService.get('NODE_URL');
    this.provider = new ethers.JsonRpcProvider(
      _nodeUrl ? _nodeUrl : defaultConfig[this.env].NODE_URL,
    );

    const _pvtKey = this.configService.get('PRIVATE_KEY');
    this.wallet = new ethers.Wallet(
      _pvtKey ? _pvtKey : defaultConfig[this.env].READ_ONLY_PVT_KEY,
      this.provider,
    );

    this.contractAddress = defaultConfig[this.env].CONTRACT_ADDRESS;
    this.pingPongABI = new ethers.Interface(PingPongABI);
  }

  private async initConnection() {
    this.logger.info(`Initializing connection to Ethereum RPC...`);
    this.contract = new ethers.Contract(
      this.contractAddress,
      this.pingPongABI,
      this.wallet,
    );

    this.logger.info(`Connected to Ethereum RPC!`);
  }

  private async subscribeToEvents() {
    this.logger.info(
      `Adding event listeners to ping pong contract on address ${this.contractAddress}`,
    );

    this.contract.on(EventTypes.PING, async (event: PingEvent) => {
      try {
        // Extract the transactionHash from the event's log
        const txHash = event?.log?.transactionHash;

        if (!txHash) {
          throw new Error('Transaction hash is missing from the event.');
        }

        this.logger.info(
          `Received Ping event with txHash: ${txHash}, event: ${JSON.stringify(
            event,
          )}`,
        );

        const newTx = new Transaction();
        newTx.TxHash = txHash;
        // const tx = await this.contract.pong(txHash);
        // this.logger.info(
        //   `Sent pong for Ping at ${txHash}, transaction: ${tx.hash}`,
        // );

        const eventData: BASE_EVENT_DATA = {
          txHash,
          timestamp: Date.now(),
        };

        // const { id: jobId } = await this.logsQueue.add(
        //   QUEUE_JOB_NAMES.PONG_TRANSACTION,
        //   {
        //     data: eventData,
        //   },
        //   {
        //     attempts: 3, // retry 3 times max
        //     backoff: {
        //       type: 'exponential', // exponential backoff strategy
        //       delay: 1000, // initial delay of 1s, increasing exponentially
        //     },
        //   },
        // );

        this.logger.info(`Added new join challenge job [jobId :]`);
      } catch (error) {
        this.logger.error(
          `Error processing Ping event with txHash: ${JSON.stringify(
            event,
          )} : ${error.stack}`,
        );
      }
    });

    // NewPinger event listener
    this.contract.on(EventTypes.NEW_PINGER, async (event) => {
      try {
        const newPingerAddress = event?.pinger as ethers.Addressable;
        const txHash = event?.log?.transactionHash as string;
        const blockNumber = event?.log?.blockNumber as number;
        const logIndex = event?.log?.logIndex as number;
        if (!newPingerAddress || !txHash) {
          throw new Error(
            'Pinger address or transaction hash is missing from the event.',
          );
        }

        this.logger.info(
          `Received NewPinger event with pinger: ${newPingerAddress}, txHash: ${txHash}`,
        );

        // TODO: Implement functionality to handle the change in pinger address

        const eventData: NEW_PINGER_EVENT_DATA = {
          txHash,
          pinger: newPingerAddress,
          timestamp: Date.now(),
          blockNumber,
          logIndex,
        };

        // const { id: jobId } = await this.logsQueue.add(
        //   QUEUE_JOB_NAMES.PONG_TRANSACTION,
        //   {
        //     data: eventData,
        //   },
        //   {
        //     attempts: 3, // retry 3 times max
        //     backoff: {
        //       type: 'exponential', // exponential backoff strategy
        //       delay: 1000, // initial delay of 1s, increasing exponentially
        //     },
        //   },
        // );

        this.logger.info(
          `Processed NewPinger event with pinger: ${newPingerAddress}`,
        );
      } catch (error) {
        this.logger.error(
          `Error processing NewPinger event: ${JSON.stringify(event)} : ${
            error.stack
          }`,
        );
      }
    });

    // Pong event listener
    this.contract.on(EventTypes.PONG, async (event) => {
      try {
        const txHash = event?.log?.transactionHash;
        const blockNumber = event?.log?.blockNumber;
        const logIndex = event?.log?.logIndex;
        const originalTxHash = event?.args?.txHash; 
        if (!txHash || !originalTxHash) {
          throw new Error(
            'Transaction hash or original txHash is missing from the event.',
          );
        }

        this.logger.info(
          `Received Pong event with txHash: ${txHash}, originalTxHash: ${originalTxHash}`,
        );

        // TODO: Implement functionality to handle the Pong event
        const eventData: PONG_EVENT_DATA = {
          txHash,
          originalTxHash,
          timestamp: Date.now(),
          blockNumber,
          logIndex,
        };

        // const { id: jobId } = await this.logsQueue.add(
        //   QUEUE_JOB_NAMES.PONG_TRANSACTION,
        //   {
        //     data: eventData,
        //   },
        //   {
        //     attempts: 3, // retry 3 times max
        //     backoff: {
        //       type: 'exponential', // exponential backoff strategy
        //       delay: 1000, // initial delay of 1s, increasing exponentially
        //     },
        //   },
        // );

        this.logger.info(`Processed Pong event with txHash: ${txHash}`);
      } catch (error) {
        this.logger.error(
          `Error processing Pong event with txHash: ${JSON.stringify(
            event,
          )} : ${error.stack}`,
        );
      }
    });

    this.logger.info(
      `Listening to [events : [${Object.values(
        EventTypes,
      )}], contract address : [${JSON.stringify(this.contractAddress)}]]...`,
    );
  }

  async getNewTransactions(
    fromBlock: number,
    limit: number = 1000,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(`Fetching transactions from block ${fromBlock}`);
      const getLatestBlock = await this.provider.getBlockNumber();
      const toBlock =
        getLatestBlock - fromBlock > limit ? fromBlock + limit : getLatestBlock;
      this.logger.info(
        `Fetching transactions from block: ${fromBlock} to block: ${toBlock}`,
      );
      const logs = await this.provider.getLogs({
        address: this.contractAddress,
        fromBlock,
        toBlock,
      });

      const parsedLogs: ParsedLog[] = logs.map((log) => ({
        log,
        parsedLog: this.contract.interface.parseLog(log),
      }));

      const result: GetNewTransactionsResult = {
        parsedLogArray: parsedLogs,
        toBlockNumber: toBlock - 1,
      };
      if (parsedLogs.length > 0) {
        this.logger.info(
          `Found log for ${
            this.contractAddress
          } finding from block: ${fromBlock} to block: ${toBlock} log result: ${JSON.stringify(
            result,
          )}`,
        );
      }
      return { data: result, error: null };
    } catch (error) {
      this.logger.error(`Error fetching new transactions: ${error.stack}`);
      return { data: null, error };
    }
  }
}
