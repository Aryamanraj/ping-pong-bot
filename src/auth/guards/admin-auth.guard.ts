import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      this.logger.info(`Validating admin api headers`);
      const request = context.switchToHttp().getRequest();
      const api_key = request?.headers['x-api-key'];
      const result = api_key === this.configService.get('ADMIN_API_KEY');
      if (result) this.logger.info(`Succesfully validated admin api headers`);
      else this.logger.error(`Failed to validate admin api headers`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error in validating admin api headers : ${error.stack}`,
      );
      return false;
    }
  }
}
