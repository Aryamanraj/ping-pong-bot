import { NestFactory } from '@nestjs/core';
import { IndexerModule } from './indexer.module';
import * as dotenv from 'dotenv';
import { dotEnvOptions } from 'config/dotenv-options';

async function bootstrap() {
  dotenv.config(dotEnvOptions);
  const PORT = process.env.PORT_INDEXER || 3002;

  const app = await NestFactory.create(IndexerModule);
  await app.listen(PORT);
}
bootstrap();
