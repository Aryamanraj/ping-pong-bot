import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { IndexedStateDto } from './dto/indexed-state.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { Response } from 'express';
import { makeResponse } from '../common/helpers/reponseMaker';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Promisify } from '../common/helpers/promisifier';
import { ApiOkResponseGeneric } from '../common/decorators/apiOkResponse.decorator';

@Controller('admin')
@ApiTags('Admin Apis')
@ApiBearerAuth('Api-auth')
@UseGuards(AdminAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class AdminController {
  constructor(
    private adminService: AdminService,
  ) {}

  @Post('/indexed-state')
  @ApiOkResponseGeneric({
    type: Boolean,
    description: 'Create last indexed state',
  })
  async handleIndexedState(
    @Body() indexedState: IndexedStateDto,
    @Res() res: Response,
  ) {
    let resStatus = HttpStatus.CREATED;
    let resMessage = 'Created new indexeed state';
    let resData = null;
    let resSuccess = true;
    try {
      const result = await Promisify<boolean>(
        this.adminService.handleIndexedState(indexedState),
      );
      resData = result;
    } catch (error) {
      resStatus = error?.status
        ? error.status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      resMessage = `Could not update last indexed state : ${error.message}`;
      resSuccess = false;
    }
    makeResponse(res, resStatus, resSuccess, resMessage, resData);
  }
}
