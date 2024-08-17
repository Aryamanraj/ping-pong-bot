import { Controller, HttpStatus, Get, Res } from '@nestjs/common';
import { HealthCheck, HealthIndicatorResult } from '@nestjs/terminus';
import { Response } from 'express';
import { HealthService } from './health.service';
import { ApiOkResponseGeneric } from '../common/decorators/apiOkResponse.decorator';
import { makeResponse } from '../common/helpers/reponseMaker';
import { Promisify } from '../common/helpers/promisifier';
import {
  ApiBadRequestResponse,
  ApiResponse,
  ApiInternalServerErrorResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('/health')
@ApiTags('Health APIs')
export class HealthCheckContoller {
  constructor(private healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOkResponseGeneric({
    type: Boolean,
    description: 'Check full health',
  })
  @ApiResponse({ status: 500, description: 'Error in checking full health' })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async check(@Res() res: Response) {
    let resStatus = HttpStatus.OK;
    let resMessage = 'Full health checked';
    let resData = null;
    let resSuccess = true;

    try {
      const fullHealth = await Promisify<HealthIndicatorResult[]>(
        this.healthService.checkFullHealth(),
      );
      resData = fullHealth;
    } catch (error) {
      resStatus = error?.status
        ? error.status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      resMessage = `Error in checking Full Health: ${error.message}`;
      resSuccess = false;
    }

    makeResponse(res, resStatus, resSuccess, resMessage, resData);
  }

  @Get('/cron-jobs')
  @ApiOkResponseGeneric({
    type: Boolean,
    description: 'Check crons health',
  })
  @ApiResponse({ status: 500, description: 'Error in checking crons health' })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async checkCronsHealth(@Res() res: Response) {
    let resStatus = HttpStatus.OK;
    let resMessage = 'crons health checked';
    let resData = null;
    let resSuccess = true;
    try {
      const cronsHealth = await Promisify<HealthIndicatorResult[]>(
        this.healthService.checkCronsHealth(),
      );

      resData = cronsHealth;
    } catch (error) {
      resStatus = error?.status
        ? error.status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      resMessage = `Error in checking Crons Health : ${error.message}`;
      resSuccess = false;
    }

    makeResponse(res, resStatus, resSuccess, resMessage, resData);
  }
}
