export const QueueNames = {
  NEW_LOGS: 'new-logs', // handle web3 interaction logs updates
};

// list of queues
export const Queues = [
  QueueNames.NEW_LOGS,
];

export const QUEUE_JOB_NAMES = {
  PONG_TRANSACTION: 'pong-queue' //job name for sending pong
};

export const CRON_JOB_NAMES = {
  CRONS_HEALTH_CHECKER: 'crons-health-checker',
};

export enum TX_EVENT_TYPE {
  PING = 'PING',
  PONG = 'PONG',
  NEW_PINGER = 'NEW_PINGER',
}

export const TX_EVENT_TYPE_ENUM = [
  'PING',
  'PONG',
  'NEW_PINGER',
];