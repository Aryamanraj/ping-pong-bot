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