import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
  HealthIndicatorStatus,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Queue } from 'bull';
import { QueueNames, Queues, CRON_JOB_NAMES } from '../common/constants';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Logger } from 'winston';
import { ResultWithError } from 'src/common/interfaces';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    @InjectQueue(QueueNames.NEW_LOGS)
    private logsQueue: Queue,
    private db: TypeOrmHealthIndicator,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    super();
  }

  async checkFullHealth(): Promise<ResultWithError> {
    try {
      this.logger.info(`Checking Full Health Status`);
      const results: HealthIndicatorResult[] = [];

      const dbHealth = await this.isDbHealth();
      results.push(dbHealth);

      for (const queue of Queues) {
        const queueHealth = await this.isQueueHealthy(queue);
        results.push(queueHealth);
      }

      return { data: results, error: null };
    } catch (error) {
      this.logger.error(`Error in Checking Full Health: ${error.stack}`);
      return { data: null, error };
    }
  }

  async checkCronsHealth(): Promise<ResultWithError> {
    try {
      this.logger.info(`Fetching Crons Health Status`);
      const results: HealthIndicatorResult[] = [];

      for (const [key, cronName] of Object.entries(CRON_JOB_NAMES)) {
        try {
          const job = this.schedulerRegistry.getCronJob(cronName);
          const next: Date | string = job.nextDate().toJSDate();
          const lastRun: Date | string = job.lastDate()
            ? job.lastDate()
            : 'Never';
          const status: HealthIndicatorStatus =
            job.running === true ? 'up' : 'down';

          const result: HealthIndicatorResult = {
            [key]: {
              status: status,
              nextRun: next,
              lastRun: lastRun,
            },
          };

          results.push(result);
        } catch (e) {
          // If the job does not exist, we catch the error and report it as 'down'
          const result: HealthIndicatorResult = {
            [key]: {
              status: 'down',
              nextRun: 'NA',
              lastRun: 'NA',
            },
          };

          results.push(result);
        }
      }

      return { data: results, error: null };
    } catch (error) {
      this.logger.error(`Error in Checking Crons Health: ${error.stack}`);
      return { data: null, error };
    }
  }

  queueMap(queueName: string): Queue {
    switch (queueName) {
      case QueueNames.NEW_LOGS:
        return this.logsQueue;
    }
  }

  private async isDbHealth(): Promise<HealthIndicatorResult> {
    return await this.db.pingCheck('typeorm');
  }

  private async isQueueHealthy(
    queueName: string,
  ): Promise<HealthIndicatorResult> {
    const queue: Queue = this.queueMap(queueName);

    const isHealthy = await queue.isReady();
    const data = {
      currentStatus: queue.client.status,
      totalJobs: await queue.count().catch(() => null),
    };

    const result = this.getStatus(
      this.healthKeyName(queueName),
      !!(await queue.isReady()),
      data,
    );

    if (!isHealthy) {
      throw new HealthCheckError(`Queue ${queueName} is not connected`, result);
    }

    return result;
  }

  protected healthKeyName(queue: string): `redis-queue:${string}` {
    return `redis-queue:${queue}`;
  }
}
