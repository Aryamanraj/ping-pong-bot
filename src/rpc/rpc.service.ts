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
import {
  QUEUE_JOB_NAMES,
  QueueNames,
  TX_EVENT_TYPE,
  TX_STATE_TYPE,
} from '../common/constants';
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
  PingEventData,
  PONG_EVENT_DATA,
  PongEvent,
  ResultWithError,
} from '../common/interfaces';
import PingPongABI from './abi/PingPong.json';
import { ethers } from 'ethers';
import { IndexedState } from '../repo/entities/indexed-state.entity';
import { IndexedStateRepoService } from '../repo/indexed-state-repo.service';

@Injectable()
export class RpcService implements OnApplicationBootstrap {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private contractAddress: string;
  private pingPongABI: ethers.Interface;
  private env: string;
  private wsProvider: ethers.WebSocketProvider;
  private chain: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectQueue(QueueNames.NEW_LOGS) private logsQueue: Queue,
    private configService: ConfigService,
    private transactionRepo: TransactionRepoService,
    private indexStateRepo: IndexedStateRepoService,
  ) {}

  async onApplicationBootstrap() {
    const defaultConfig = ONCHAIN_CONFIG;
    this.env = (this.configService.get('NODE_ENV') ||
      'development') as keyof typeof defaultConfig;
    await this.initializeConfig(defaultConfig);
    await this.initConnection();
    if (this.env !== 'test') this.subscribeToEvents();
  }

  private async initializeConfig(defaultConfig) {
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
    this.chain = defaultConfig[this.env].CHAIN;
    const idxState = await Promisify<IndexedState>(
      this.indexStateRepo.get({ where: { Network: this.chain } }),
    );
    this.contractAddress = idxState.ContractAddress;
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

        const pingEventData: PingEventData = {
          txHash: event?.log?.transactionHash as string,
          blockNumber: (event?.log?.blockNumber as number) ?? null,
          logIndex: (event?.log?.index as number) ?? null,
        }
        if (!pingEventData.txHash) {
          throw new Error('Transaction hash is missing from the event.');
        }

        this.logger.info(
          `Received Ping event with txHash: ${pingEventData.txHash}, blockNumber: ${pingEventData.blockNumber}, logIndex: ${pingEventData.logIndex}, event: ${JSON.stringify(
            event,
          )}`,
        );

        const { error } = await this.handlePingEventUpdate(pingEventData);
        if (error) throw error;

        // Handle the Ping event as needed
        const eventData: BASE_EVENT_DATA = {
          txHash: pingEventData.txHash,
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
            newPinger: newPingerAddress,
            timestamp: Date.now(),
            blockNumber,
            logIndex,
          };
          const { error } = await this.handleNewPingerEventUpdate(eventData);
          if (error) throw error;

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
          const txHash = event?.log?.transactionHash;
          const blockNumber = event?.log?.blockNumber;
          const logIndex = event?.log?.index;

          const originalTxHash = pingHash;

          if (!txHash || !originalTxHash) {
            throw new Error(
              'Transaction hash or original txHash is missing from the event.',
            );
          }

          this.logger.info(
            `Received Pong event with txHash: ${txHash}, originalTxHash: ${originalTxHash}, blockNumber: ${blockNumber}, logIndex: ${logIndex}`,
          );

          const eventData: PONG_EVENT_DATA = {
            txHash,
            originalTxHash,
            timestamp: Date.now(),
            blockNumber,
            logIndex,
          };

          const { error } = await this.handlePongEventUpdate(eventData);
          if (error) throw error;

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

      const transaction = await Promisify<Transaction>(
        this.transactionRepo.get({ where: { TxHash: data.txHash } }),
      );

      // throw error if incorrect tx state
      if (transaction.TxState != TX_STATE_TYPE.PONGING) {
        this.logger.error(
          `error in processing send pong transaction, incorrect state: ${
            transaction.TxState
          }  [data : ${JSON.stringify(data)}]`,
        );
        throw new Error(
          `Incorrect state: ${transaction.TxState} for sending pong transaction expected state to be: ${TX_STATE_TYPE.PONGING}`,
        );
      }
      try {
        // Call the pong function on the contract using the txHash from the event data
        const tx = await this.contract.pong(ethers.id(data.txHash));

        this.logger.info(`Pong transaction sent. Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        this.logger.info(
          `Pong receipt generated. Transaction hash: ${
            tx.hash
          }, Tx receipt: ${JSON.stringify(receipt)}`,
        );
        if (receipt.status !== 1) {
          const { error: UpdateTxError } = await this.transactionRepo.update(
            { TxID: transaction.TxID },
            {
              TxState: TX_STATE_TYPE.PINGED,
            },
          );
          if (UpdateTxError) throw UpdateTxError;
        }
        const updatedTransaction = await Promisify<Transaction>(
          this.transactionRepo.get({ where: { TxHash: data.txHash } }),
        );
        if (updatedTransaction.TxState !== TX_STATE_TYPE.PONG_CONFIRMED) {
          this.logger.info(
            `Transaction completed but event not heard yet, updating state to ${TX_STATE_TYPE.PONGED}`,
          );
          const { error: UpdateTxError } = await this.transactionRepo.update(
            { TxID: transaction.TxID },
            {
              TxState: TX_STATE_TYPE.PONG_CONFIRMED,
            },
          );
          if (UpdateTxError) throw UpdateTxError;
        }
      } catch (txError) {
        this.logger.error(`Transaction failed: ${txError.message}`);

        await this.transactionRepo.update(
          { TxID: transaction.TxID },
          {
            TxState: TX_STATE_TYPE.PINGED,
          },
        );

        throw txError;
      }
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

  async handlePongEventUpdate(eventData: PONG_EVENT_DATA): Promise<{ error }> {
    const { originalTxHash, txHash, blockNumber, timestamp, logIndex } =
      eventData;
    try {
      const block = blockNumber
        ? await this.provider.getBlock(blockNumber)
        : null;
      const { error: UpdateTxError } = await this.transactionRepo.update(
        { TxHash: originalTxHash },
        {
          TxState: TX_STATE_TYPE.PONG_CONFIRMED,
          PongTxHash: txHash,
          PongBlockNumber: blockNumber,
          PongLogIndex: logIndex,
          PongTimestamp: block?.timestamp ?? timestamp,
        },
      );
      if (UpdateTxError) throw UpdateTxError;

      this.logger.info(
        `Updated transaction for Pong event with txHash: ${txHash}`,
      );
      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error updating transaction for Pong event with txHash: ${txHash} : ${error.stack}`,
      );
      return { error };
    }
  }

  async handlePingEventUpdate({
    txHash,
    blockNumber,
    logIndex,
  }: {
    txHash: string;
    blockNumber: number | null;
    logIndex: number | null;
  }): Promise<{ error }> {
    try {
      const newTx = new Transaction();

      newTx.TxHash = txHash;
      newTx.BlockNumber = blockNumber;
      newTx.LogIndex = logIndex;
      newTx.TxType = TX_EVENT_TYPE.PING;
      newTx.TxState = TX_STATE_TYPE.PINGED;
      newTx.Network = this.chain;

      // Fetch the block details to get the timestamp
      const block = blockNumber
        ? await this.provider.getBlock(blockNumber)
        : null;
      const timestamp = block?.timestamp ?? null;
      newTx.Timestamp = timestamp;

      await newTx.save();

      this.logger.info(`Saved Ping transaction with txHash: ${txHash}`);
      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error saving Ping transaction with txHash: ${txHash} : ${error.stack}`,
      );
      return { error };
    }
  }

  async handleNewPingerEventUpdate(
    eventData: NEW_PINGER_EVENT_DATA,
  ): Promise<{ error }> {
    const { txHash, newPinger, blockNumber, logIndex, timestamp } = eventData;
    try {
      // Update the transaction table
      const newTx = new Transaction();
      newTx.TxHash = txHash;
      newTx.BlockNumber = blockNumber;
      newTx.LogIndex = logIndex;
      newTx.TxType = TX_EVENT_TYPE.NEW_PINGER;
      newTx.TxState = TX_STATE_TYPE.NEW_PINGER_UPDATE_PROCESSING;
      newTx.Network = this.chain;
      newTx.Timestamp = timestamp;
      await newTx.save();

      this.logger.info(
        `Saved NewPinger transaction with txHash: ${txHash}, updating IndexedState`,
      );

      // Update the IndexedState table with the new contract address
      const indexedState = await Promisify<IndexedState>(
        this.indexStateRepo.get({
          where: { Network: this.chain },
        }),
      );
      indexedState.ContractAddress = await newPinger.getAddress();
      indexedState.BlockNumber = blockNumber;
      await indexedState.save();

      // Update the contract address in the RpcService instance
      this.contractAddress = await newPinger.getAddress();

      // Update the transaction state to indicate processing is complete
      await this.transactionRepo.update(
        { TxHash: txHash },
        {
          TxState: TX_STATE_TYPE.NEW_PINGER_UPDATE_PROCESSED,
        },
      );

      this.logger.info(
        `Updated IndexedState and contract address for NewPinger event with txHash: ${txHash}`,
      );
      return { error: null };
    } catch (error) {
      this.logger.error(
        `Error updating transaction and IndexedState for NewPinger event with txHash: ${txHash} : ${error.stack}`,
      );
      return { error };
    }
  }
}
