import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DBModule } from '../db/db.module';
import configuration from 'config/configuration';
import { RepoModule, entities } from '../repo/repo.module';
import { QueueModule } from '../queue/queue.module';
import { WinstonModule } from 'nest-winston';
import * as path from 'path';
import * as winston from 'winston';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.printf((info) => {
          const message = `${info.timestamp} ${info.level.toUpperCase()}: ${
            info.message
          }`;
          if (info.level === 'error') {
            return winston.format.colorize().colorize('error', message);
          }
          return message;
        }),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.colorize({ all: true }),
        }),
        new winston.transports.File({
          dirname: path.join('logs/'),
          filename: 'error_idx.log',
          level: 'error',
        }),
        new winston.transports.File({
          dirname: path.join('logs/'),
          filename: 'combined_idx.log',
        }),
      ],
    }),
    DBModule.forRoot({
      entities: entities,
    }),
    RepoModule,
    QueueModule.forRoot(),
    RpcModule,
  ],
  controllers: [],
  providers: [],
})
export class IndexerModule {}
