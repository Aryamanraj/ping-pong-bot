import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body, headers } = req;
    const start = Date.now();

    this.logger.info(
      'http' +
        ` [Request]\t${method} ${originalUrl}, Headers: ${JSON.stringify(
          headers,
        )}, Body: ${JSON.stringify(body)}`,
    );

    res.on('finish', () => {
      const { method, originalUrl } = req;
      const { statusCode, statusMessage } = res;
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - start;

      const message = ` FINISH [Response]\t${method} ${originalUrl} ${statusCode} ${statusMessage}, Response Time: ${responseTime}ms, Total Memory : ${memoryUsage.heapTotal}, Memory Used : ${memoryUsage.heapUsed}`;

      if (statusCode >= 500) {
        return this.logger.error(message);
      }

      if (statusCode >= 400) {
        return this.logger.warn(message);
      }

      return this.logger.info('http' + message);
    });

    res.on('close', () => {
      const { method, originalUrl } = req;
      const { statusCode, statusMessage } = res;
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - start;

      const message = ` CLOSE [Response]\t${method} ${originalUrl} ${statusCode} ${statusMessage}, Response Time: ${responseTime}ms, Total Memory : ${memoryUsage.heapTotal}, Memory Used : ${memoryUsage.heapUsed}`;

      if (statusCode >= 500) {
        return this.logger.error(message);
      }

      if (statusCode >= 400) {
        return this.logger.warn(message);
      }

      return this.logger.info('http' + message);
    });

    next();
  }
}
