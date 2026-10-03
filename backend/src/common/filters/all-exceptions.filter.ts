import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AppException } from '../errors/app.exception.js';

/**
 * Every error leaves the API as `{ error: { code, message, details? } }`.
 * Unexpected errors are logged in full but reach the client only as a generic message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { code: string; message: string; details?: unknown } = {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details };
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = { code: httpCode(status), message: safeMessage(exception, status) };
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl}`, exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ error: body });
  }
}

function httpCode(status: number): string {
  return (HttpStatus[status] as string | undefined) ?? 'ERROR';
}

function safeMessage(e: HttpException, status: number): string {
  if (status === HttpStatus.NOT_FOUND) return 'The requested resource was not found.';
  const response = e.getResponse();
  const msg = typeof response === 'object' && response && 'message' in response ? response.message : e.message;
  return typeof msg === 'string' ? msg : 'The request could not be completed.';
}
