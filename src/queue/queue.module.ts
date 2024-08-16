import { BullModule, BullRootModuleOptions } from '@nestjs/bull';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({})
export class QueueModule {
  public static getConnection(configService: ConfigService) {
    const connectionOption: BullRootModuleOptions =
      QueueModule.getConnectionDetails(configService);

    return connectionOption;
  }

  private static getConnectionDetails(
    configService: ConfigService,
  ): BullRootModuleOptions {
    return {
      redis: {
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        // password: configService.get('REDIS_PASSWORD'), // removing this for dev to help with unnecessary logs
        // username: configService.get('REDIS_USER'),
      },
    };
  }

  public static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) =>
            QueueModule.getConnection(configService),
        }),
      ],
      controllers: [],
      providers: [],
      exports: [],
    };
  }
}
