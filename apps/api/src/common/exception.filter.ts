import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import type { AppRequest } from './types.js';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

/**
 * Converts every error into `{ error: { code, message, details?, requestId } }`.
 * Unexpected errors are logged with full detail but returned to the client as a generic message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AppRequest>();
    const requestId = req.id ? String(req.id) : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again later.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = STATUS_CODES[status] ?? 'ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.code === 'string') code = b.code;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.join(', ');
        details = b.details;
      }
      if (status === 429) message = 'Too many requests. Please wait a moment and try again.';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, code, message } = mapPrismaError(exception));
    }

    if (status >= 500) {
      this.logger.error({ err: exception, requestId, path: req.originalUrl }, 'Unhandled error');
    }

    if (res.headersSent) return;
    res.status(status).json({ error: { code, message, ...(details ? { details } : {}), ...(requestId ? { requestId } : {}) } });
  }
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | string | undefined) ?? (error.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } })?.driverAdapterError?.cause?.constraint?.fields;
      const fields = Array.isArray(target) ? target.join(', ') : target;
      return { status: 409, code: 'CONFLICT', message: fields ? `A record with this ${fields} already exists.` : 'A record with these details already exists.' };
    }
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' };
    case 'P2003':
      return { status: 409, code: 'CONFLICT', message: 'This record is referenced by other data or references a missing record.' };
    default:
      return { status: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' };
  }
}
