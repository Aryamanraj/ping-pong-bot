import { ApiProperty } from '@nestjs/swagger';
import { Response } from 'express';
export const makeResponse = (
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data = null,
) => {
  res.status(statusCode).json({
    success: success,
    message: message,
    data: data,
  });
};

export class ResponseType<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data: T;
}
