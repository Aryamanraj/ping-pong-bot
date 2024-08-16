import {
  Controller,
  Post,
  HttpStatus,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Body,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { Response } from 'express';
import { makeResponse } from '../common/helpers/reponseMaker';
import { ScheduleService } from '../schedule/schedule.service';
import { StartCronDto } from './dto/start-cron.dto';
import { CronExpression } from '@nestjs/schedule';
import { ApiOkResponseGeneric } from '../common/decorators/apiOkResponse.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('admin/healthCron')
@ApiTags('Health cron api')
@ApiBearerAuth('Api-auth')
@UseGuards(AdminAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class CronsHealthController {
  constructor(private schedulerService: ScheduleService) {}

  @Post('/cron-jobs/start')
  @ApiOkResponseGeneric({
    type: Boolean,
    description: 'Start crons health checker',
  })
  async startCronsHealthChecker(
    @Res() res: Response,
    @Body() data: StartCronDto,
  ) {
    let resStatus = HttpStatus.OK;
    let resMessage = 'Started crons health checker';
    let resData = null;
    let resSuccess = true;
    try {
      const result = await this.schedulerService.startCronsHealthChecker(
        data.timePeriod as CronExpression,
      );
      if (result.error) throw result.error;

      resData = result.data;
    } catch (error) {
      resStatus = resStatus = error?.status
        ? error.status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      resMessage = `Could not start crons health checker : ${error.message}`;
      resSuccess = false;
    }
    makeResponse(res, resStatus, resSuccess, resMessage, resData);
  }

  @Post('/cron-jobs/stop')
  @ApiOkResponseGeneric({
    type: Boolean,
    description: 'Stop crons health checker',
  })
  async stopCronsHealthChecker(@Res() res: Response) {
    let resStatus = HttpStatus.OK;
    let resMessage = 'Stopped crons health checker';
    let resData = null;
    let resSuccess = true;
    try {
      const result = await this.schedulerService.stopCronsHealthChecker();
      if (result.error) throw result.error;

      resData = result.data;
    } catch (error) {
      resStatus = resStatus = error?.status
        ? error.status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      resMessage = `Could not stop crons health checker : ${error.message}`;
      resSuccess = false;
    }
    makeResponse(res, resStatus, resSuccess, resMessage, resData);
  }
}
