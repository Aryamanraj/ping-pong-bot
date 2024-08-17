export const QueueNames = {
  NEW_LOGS: 'new-logs', // handle web3 interaction logs updates
  LATE_LOGS: 'late-logs' //handle late log web3 interactions
};

// list of queues
export const Queues = [QueueNames.NEW_LOGS, QueueNames.LATE_LOGS];

export const QUEUE_JOB_NAMES = {
  PONG_TRANSACTION: 'pong-queue', //job name for sending pong
  LATE_PONG_TRANSACTION: 'late-pong-queue', //job name for sending pong
};

export const CRON_JOB_NAMES = {
  CRONS_HEALTH_CHECKER: 'crons-health-checker',
  LATE_SEND_PONG: 'late-send-pong-cron'
};

export enum TX_EVENT_TYPE {
  PING = 'PING',
  PONG = 'PONG',
  NEW_PINGER = 'NEW_PINGER',
}

export const TX_EVENT_TYPE_ENUM = ['PING', 'PONG', 'NEW_PINGER'];

export enum TX_STATE_TYPE {
  PINGED = 'PINGED',
  PONGING = 'PONGING',
  PONGED = 'PONGED',
  PONG_CONFIRMED = 'PONG_CONFIRMED',
  NEW_PINGER = 'NEW_PINGER',
  NEW_PINGER_UPDATE_PROCESSING = 'NEW_PINGER_UPDATE_PROCESSING',
  NEW_PINGER_UPDATE_PROCESSED = 'NEW_PINGER_UPDATE_PROCESSED',
}

export const TX_STATE_TYPE_ENUM = [
  'PINGED',
  'PONG_SENT',
  'PONGED',
  'PONG_CONFIRMED',
  'NEW_PINGER',
  'NEW_PINGER_UPDATE_PROCESSING',
  'NEW_PINGER_UPDATE_PROCESSED',
];

export const CUTOFF_TIME = 1 * 60 // 10 mintues