import { Inject, Injectable } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { BASE_EVENT_DATA, ResultWithError } from '../common/interfaces';
import { CronJob } from 'cron';
import { FindManyOptions, LessThanOrEqual } from 'typeorm';
import { Promisify } from '../common/helpers/promisifier';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  CRON_JOB_NAMES,
  CUTOFF_TIME,
  QUEUE_JOB_NAMES,
  QueueNames,
  TX_EVENT_TYPE,
  TX_STATE_TYPE,
} from '../common/constants';
import { Transaction } from '../repo/entities/transaction.entity';
import { TransactionRepoService } from '../repo/transaction-repo.service';

@Injectable()
export class ScheduleService {
  private isLateSendPongProcessing: boolean;
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectQueue(QueueNames.NEW_LOGS) private newLogsQueue: Queue,
    @InjectQueue(QueueNames.LATE_LOGS) private lateLogsQueue: Queue,
    private schedulerRegistry: SchedulerRegistry,
    private transactionRepo: TransactionRepoService,
  ) {}

  async startLatePongSettlementChecker(
    cronTime: CronExpression = CronExpression.EVERY_10_MINUTES,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `Starting late pong settlement checker : ${JSON.stringify(cronTime)}`,
      );

      let job: CronJob<null, null> = undefined;
      try {
        job = this.schedulerRegistry.getCronJob(CRON_JOB_NAMES.LATE_SEND_PONG);
      } catch (error) {
        this.logger.info(
          `No cron job present [jobName : ${CRON_JOB_NAMES.LATE_SEND_PONG}]`,
        );
      }
      if (job) {
        this.logger.info(`Found old job, removing it`);
        job.stop();
        this.schedulerRegistry.deleteCronJob(CRON_JOB_NAMES.LATE_SEND_PONG);
      }

      job = new CronJob(cronTime, async () => {
        await this.handleLateSendPongSettlement();
      });
      this.schedulerRegistry.addCronJob(CRON_JOB_NAMES.LATE_SEND_PONG, job);

      job.start();
      this.logger.info(
        `added and started late send pong settlement checker cron job`,
      );
      return { data: { success: true }, error: null };
    } catch (error) {
      this.logger.error(
        `Error in starting late send pong settlement checker : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async stopPongSettlementChecker() {
    try {
      this.logger.info(`Stopping late send pong settlement checker`);

      const job = this.schedulerRegistry.getCronJob(
        CRON_JOB_NAMES.LATE_SEND_PONG,
      );

      if (!job) {
        this.logger.info(
          `late send pong settlement checker job does not exist`,
        );
        return { data: { success: true }, error: null };
      }

      job.stop();
      this.logger.info(`stopped late send pong settlement cron job`);
      return { data: { success: true }, error: null };
    } catch (error) {
      this.logger.error(
        `Error in stopping late send pong settlement checker : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async startCronsHealthChecker(
    cronTime: CronExpression = CronExpression.EVERY_10_MINUTES,
  ): Promise<ResultWithError> {
    try {
      this.logger.info(
        `[CronsHealth] Starting crons health checker : ${JSON.stringify(
          cronTime,
        )}`,
      );

      let job: CronJob<null, null> = undefined;
      try {
        job = this.schedulerRegistry.getCronJob(
          CRON_JOB_NAMES.CRONS_HEALTH_CHECKER,
        );
      } catch (error) {
        this.logger.info(
          `[CronsHealth] No cron job present [jobName : ${CRON_JOB_NAMES.CRONS_HEALTH_CHECKER}]`,
        );
      }

      if (job) {
        this.logger.info(`[CronsHealth] Found old job, removing it`);
        job.stop();
        this.schedulerRegistry.deleteCronJob(
          CRON_JOB_NAMES.CRONS_HEALTH_CHECKER,
        );
      }

      job = new CronJob(cronTime, async () => {
        await this.handleCronsHealthCheck();
      });
      this.schedulerRegistry.addCronJob(
        CRON_JOB_NAMES.CRONS_HEALTH_CHECKER,
        job,
      );

      job.start();
      this.logger.info(`[CronsHealth] added and started crons health checker`);
      return { data: { success: true }, error: null };
    } catch (error) {
      this.logger.error(
        `[CronsHealth] Error in starting crons health checker : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  async stopCronsHealthChecker() {
    try {
      this.logger.info(`[CronsHealth] Stopping crons health checker`);

      const job = this.schedulerRegistry.getCronJob(
        CRON_JOB_NAMES.CRONS_HEALTH_CHECKER,
      );

      if (!job) {
        this.logger.info(
          `[CronsHealth] crons health checker job does not exist`,
        );
        return { data: { success: true }, error: null };
      }

      job.stop();
      this.logger.info(`[CronsHealth] stopped crons health checker job`);
      return { data: { success: true }, error: null };
    } catch (error) {
      this.logger.error(
        `[CronsHealth] Error in stopping crons health checker : ${error.stack}`,
      );
      return { data: null, error };
    }
  }

  private async handleLateSendPongSettlement() {
    try {
      if (this.isLateSendPongProcessing) {
        this.logger.info(
          `Already processing late send pong settlement update... sleeping till next time interval`,
        );
        return;
      }

      this.isLateSendPongProcessing = true;
      this.logger.info(
        `Processing late send pong settlement for eligible challeneges`,
      );

      const options: FindManyOptions<Transaction> = {
        where: {
          TxType: TX_EVENT_TYPE.PING,
          TxState: TX_STATE_TYPE.PINGED,
          Timestamp: LessThanOrEqual(
            Math.floor(Date.now() / 1000) - CUTOFF_TIME,
          ),
        },
      };
      // get all the transaction with pinged but not ponged and older than 10 minutes (CUTOFF_TIME)
      const transactions = await Promisify<Transaction[]>(
        this.transactionRepo.getAll(options, false),
      );

      this.logger.info(
        `Processing ${transactions.length} late send pongs for settlement`,
      );

      for (const transaction of transactions) {
        const eventData: BASE_EVENT_DATA = {
          txHash: transaction.TxHash,
          timestamp: Date.now(),
        };
        const job = await this.lateLogsQueue.add(
          QUEUE_JOB_NAMES.LATE_PONG_TRANSACTION,
          { data: eventData },
        );
        this.logger.info(
          `Added processing late send pong settlement job [queue : ${
            QueueNames.LATE_LOGS
          }, jobName : ${QUEUE_JOB_NAMES.LATE_PONG_TRANSACTION}, jobId : ${
            job.id
          }, with data: ${JSON.stringify(eventData)}]`,
        );
      }

      this.logger.info(
        `Done updating ${transactions.length} late send pong for settlement`,
      );
    } catch (error) {
      this.logger.error(
        `Error in processing late send pong cron : ${error.stack}`,
      );
    }
    this.isLateSendPongProcessing = false;
  }

  private async handleCronsHealthCheck() {
    try {
      this.logger.info(
        '[CronsHealth] Processing health checks for crons just started',
      );

      for (const [, cronName] of Object.entries(CRON_JOB_NAMES)) {
        try {
          const job = this.schedulerRegistry.getCronJob(cronName);
          const next: Date | string = job.nextDate().toJSDate();
          const lastRun: Date | string = job.lastDate()
            ? job.lastDate().toDateString()
            : 'Never';
          const status: string = job.running === true ? 'up' : 'down';

          this.logger.info(
            `Job: ${cronName} -> Status: ${status}, Next: ${next}, Last Run: ${lastRun}`,
          );
        } catch (error) {
          // If the job does not exist, log it as 'down'
          this.logger.info(
            `Job: ${cronName} -> Status: down, Next: NA, Last Run: NA`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `[CronsHealth] Error in checking crons health: ${error.stack}`,
      );
    }
  }
}
