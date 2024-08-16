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
import { BASE_EVENT_DATA, ResultWithError } from '../common/interfaces';
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
      _pvtKey ? _pvtKey : defaultConfig[this.env].PRIVATE_KEY,
      this.provider,
    );

    this.contractAddress = defaultConfig[this.env].contractAddress;

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

    this.contract.on(EventTypes.PING, async (txHash: string) => {
      try {
        this.logger.info(`Received Ping event with txHash: ${txHash}`);

        const tx = await this.contract.pong(txHash);
        this.logger.info(
          `Sent pong for Ping at ${txHash}, transaction: ${tx.hash}`,
        );

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
        this.logger.info(`Added new join challenge job [jobId : ${jobId}]`);
      } catch (error) {
        this.logger.error(
          `Error processing Ping event with txHash: ${txHash} : ${error.stack}`,
        );
      }
    });
    this.logger.info(
      `Listening to [events : [${Object.values(
        EventTypes,
      )}], contract address : [${JSON.stringify(this.contractAddress)}]]...`,
    );
  }
}
