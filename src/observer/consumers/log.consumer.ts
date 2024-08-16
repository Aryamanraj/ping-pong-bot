import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { LogObserverService } from '../services/log-observer.service';
import { Job } from 'bull';
import { QUEUE_JOB_NAMES, QueueNames } from '../../common/constants';

@Processor(QueueNames.NEW_LOGS)
export class LogConsumer {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private logObserverService: LogObserverService,
  ) {}

  @Process(QUEUE_JOB_NAMES.PONG_TRANSACTION)
  async handleSendPongTransaction(job: Job) {
    try {
      this.logger.info(`Processing send pong [jobId : ${job.id}]`);
      job.progress(0);

      const { error } = await this.logObserverService.handleSendPong(
        job.data.data,
      );

      if (error) {
        this.logger.error(`Moving the job to failed queue [jobId : ${job.id}]`);
        await job.moveToFailed(error);
      }
      job.progress(100);
    } catch (error) {
      this.logger.error(
        `Error in processing send pong job [jobId : ${job.id}] : ${error.stack}`,
      );
    }
  }

  @OnQueueFailed()
  async handleFailedJobs(job: Job, err: Error) {
    this.logger.error(
      `Escrow interaction job failed with error [jobId : ${job.id}, error : ${err.message}]`,
    );
    if (job.attemptsMade < job.opts.attempts) {
      this.logger.info(`Retrying job [jobId : ${job.id}]`);
      await job.retry();
    } else {
      this.logger.error(
        `Job has failed maximum number of times : [jobId : ${job.id}]`,
      );
    }
  }
}
