import { applyDecorators, BadRequestException, Injectable, type PipeTransform, type ArgumentMetadata } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

export interface ZodDtoClass<T extends ZodType = ZodType> {
  new (): z.output<T>;
  zodSchema: T;
}

/**
 * Creates a DTO class backed by a shared Zod schema. The class carries the schema so the
 * global ZodValidationPipe can validate and transform request bodies, params and queries.
 */
export function createZodDto<T extends ZodType>(schema: T): ZodDtoClass<T> {
  class ZodDto {
    static zodSchema = schema;
  }
  return ZodDto as unknown as ZodDtoClass<T>;
}

export function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

export function parseOrThrow<T extends ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', details: formatZodIssues(result.error) });
  }
  return result.data;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = (metadata.metatype as Partial<ZodDtoClass> | undefined)?.zodSchema;
    if (!schema) return value;
    return parseOrThrow(schema, value ?? {});
  }
}

function toJsonSchema(schema: ZodType): Record<string, unknown> {
  try {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete json.$schema;
    return json;
  } catch {
    return { type: 'object' };
  }
}

/** Documents a Zod-validated JSON body in Swagger. */
export function ApiZodBody(dto: ZodDtoClass) {
  return ApiBody({ schema: toJsonSchema(dto.zodSchema) as never });
}

/** Documents each property of a Zod object query schema as a Swagger query parameter. */
export function ApiZodQuery(dto: ZodDtoClass) {
  const json = toJsonSchema(dto.zodSchema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const decorators = Object.entries(json.properties ?? {}).map(([name, schema]) =>
    ApiQuery({ name, required: false, schema: schema as never }),
  );
  return applyDecorators(...decorators);
}
