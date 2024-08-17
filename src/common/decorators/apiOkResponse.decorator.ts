import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseType } from '../helpers/reponseMaker';

export const ApiOkResponseGeneric = <T extends Type<unknown>>({
  type,
  description,
  status = 200,
  isArray = false,
}: {
  type: T;
  description?: string;
  status?: number;
  isArray?: boolean;
}) =>
  applyDecorators(
    ApiExtraModels(ResponseType, type),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseType) },
          {
            properties: {
              data: isArray
                ? { type: 'array', items: { $ref: getSchemaPath(type) } }
                : {
                    $ref: getSchemaPath(type),
                  },
            },
          },
        ],
      },
    }),
  );
