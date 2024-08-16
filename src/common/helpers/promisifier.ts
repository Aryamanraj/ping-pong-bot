import { ResultWithError } from '../interfaces';

export function Promisify<T>(req: Promise<ResultWithError>): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const { data: result, error } = await req;
      if (error) throw error;

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}
