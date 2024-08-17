import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RepoModule } from '../repo/repo.module';
import { JwtModule } from '@nestjs/jwt';
import { LoggerMiddleware } from '../common/middlewares/logger.middleware';

@Module({
  imports: [RepoModule, JwtModule.register({})],
  providers: [],
  controllers: [],
  exports: [],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware);
  }
}
