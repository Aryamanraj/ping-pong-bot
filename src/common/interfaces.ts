import { ethers, Log as ethersLog, LogDescription } from 'ethers';

export interface ResultWithError {
  error: any;
  data: any;
}

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type JSONArray = Array<JSONValue>;

export interface BASE_EVENT_DATA {
  txHash: string;
  timestamp: number;
}

export interface NEW_PINGER_EVENT_DATA extends BASE_EVENT_DATA {
  pinger: ethers.Addressable;
  blockNumber: number;
  logIndex: number;
}

export interface PONG_EVENT_DATA extends BASE_EVENT_DATA {
  originalTxHash: string;
  blockNumber: number;
  logIndex: number;
}

interface Log {
  _type: string;
  address: string;
  blockHash: string;
  blockNumber: number;
  data: string;
  index: number;
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: number;
}

interface Fragment {
  type: string;
  inputs: any[]; 
  name: string;
  anonymous?: boolean;
}

interface Emitter {
  target: string;
  interface: {
    fragments: Fragment[];
    deploy: Fragment;
    fallback: null | any;
    receive: boolean;
  };
  runner: {
    provider: any; 
    address: string;
  };
  filters: any;
  fallback: null | any;
}

export interface PingEvent {
  filter: string;
  emitter: Emitter;
  log: Log;
  args: any[];
  fragment: Fragment;
}

export interface ParsedLog {
  log: ethersLog;
  parsedLog: LogDescription;
}

export interface GetNewTransactionsResult {
  parsedLogArray: ParsedLog[];
  toBlockNumber: number;
}