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
  NewPingerEvent,
  ParsedLog,
  PingEvent,
  PONG_EVENT_DATA,
  PongEvent,
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
  private wsProvider: ethers.WebSocketProvider;

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
    const _nodeWssUrl = this.configService.get('NODE__WSS_URL');
    this.provider = new ethers.JsonRpcProvider(
      _nodeUrl ? _nodeUrl : defaultConfig[this.env].NODE_URL,
    );

    this.wsProvider = new ethers.WebSocketProvider(
      _nodeWssUrl ? _nodeWssUrl : defaultConfig[this.env].NODE_WSS_URL,
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
      this.wallet.connect(this.wsProvider),
    );

    this.logger.info(`Connected to Ethereum RPC!`);
  }

  private async subscribeToEvents() {
    this.logger.info(
      `Adding event listeners to ping pong contract on address ${this.contractAddress}`,
    );

    this.contract.on(EventTypes.PING, async (event: PingEvent) => {
      try {
        // Extract the transaction hash from the event's log
        const txHash = event?.log?.transactionHash as string;
        const blockNumber = event?.log?.blockNumber as number;
        const logIndex = event?.log?.index as number;

        if (!txHash) {
          throw new Error('Transaction hash is missing from the event.');
        }

        this.logger.info(
          `Received Ping event with txHash: ${txHash}, blockNumber: ${blockNumber}, logIndex: ${logIndex}, event: ${JSON.stringify(
            event,
          )}`,
        );

        // Handle the Ping event as needed
        const eventData: BASE_EVENT_DATA = {
          txHash,
          timestamp: Date.now(),
        };

        const { id: jobId } = await this.logsQueue.add(
          QUEUE_JOB_NAMES.PONG_TRANSACTION,
          {
            data: eventData,
          },
          {
            attempts: 3, // retry 3 times max
            backoff: {
              type: 'exponential', // exponential backoff strategy
              delay: 1000, // initial delay of 1s, increasing exponentially
            },
          },
        );

        this.logger.info(`Added new join challenge job for jobId: ${jobId}`);
      } catch (error) {
        this.logger.error(
          `Error processing Ping event with txHash: ${event?.log?.transactionHash} : ${error.stack}`,
        );
      }
    });

    // NewPinger event listener
    this.contract.on(
      EventTypes.NEW_PINGER,
      async (newPingerAddress: ethers.Addressable, event: NewPingerEvent) => {
        try {
          // Extract the transaction hash of the NewPinger transaction
          const txHash = event?.log?.transactionHash;
          const blockNumber = event?.log?.blockNumber;
          const logIndex = event?.log?.index;

          // The newPingerAddress is directly provided by the event arguments
          if (!txHash || !newPingerAddress) {
            throw new Error(
              'Transaction hash or newPinger address is missing from the event.',
            );
          }

          this.logger.info(
            `Received NewPinger event with txHash: ${txHash}, newPingerAddress: ${newPingerAddress}, blockNumber: ${blockNumber}, logIndex: ${logIndex}`,
          );

          // Handle the NewPinger event as needed, using the newPingerAddress and txHash
          const eventData: NEW_PINGER_EVENT_DATA = {
            txHash,
            pinger: newPingerAddress,
            timestamp: Date.now(),
            blockNumber,
            logIndex,
          };

          // const { id: jobId } = await this.logsQueue.add(
          //   QUEUE_JOB_NAMES.NEW_PINGER_TRANSACTION,
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

          this.logger.info(`Processed NewPinger event with txHash: ${txHash}`);
        } catch (error) {
          this.logger.error(
            `Error processing NewPinger event with txHash: ${event?.log?.transactionHash} : ${error.stack}`,
          );
        }
      },
    );

    // Pong event listener
    this.contract.on(
      EventTypes.PONG,
      async (pingHash: string, event: PongEvent) => {
        try {
          // Extract the transaction hash of the Pong transaction
          const txHash = event?.log?.transactionHash;
          const blockNumber = event?.log?.blockNumber;
          const logIndex = event?.log?.index;

          // Extract the original txHash passed to the Pong function
          const originalTxHash = pingHash; // This represents the `_txHash` passed to the `pong` function

          if (!txHash || !originalTxHash) {
            throw new Error(
              'Transaction hash or original txHash is missing from the event.',
            );
          }

          this.logger.info(
            `Received Pong event with txHash: ${txHash}, originalTxHash: ${originalTxHash}, blockNumber: ${blockNumber}, logIndex: ${logIndex}`,
          );

          // Handle the Pong event as needed, using both txHash and originalTxHash
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
            `Error processing Pong event with txHash: ${event?.log?.transactionHash} : ${error.stack}`,
          );
        }
      },
    );

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

  async handleSendPong(data: BASE_EVENT_DATA): Promise<{ error }> {
    try {
      this.logger.info(`Processing send pong [data : ${JSON.stringify(data)}]`);

      // Call the pong function on the contract using the txHash from the event data
      const tx = await this.contract.pong(ethers.id(data.txHash));

      this.logger.info(`Pong transaction sent. Transaction hash: ${tx.hash}`);

      // Optional: You can store the transaction hash in the database or perform additional processing here

      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error processing pong transaction [data : ${JSON.stringify(data)}] : ${
          error.stack
        }`,
      );
      return { error };
    }
  }
}
