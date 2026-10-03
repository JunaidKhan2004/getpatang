import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

import { Paginated } from '../pagination.js';

/** Wraps successful responses as `{ data }`, or `{ data, meta }` for paginated lists. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => (result instanceof Paginated ? { data: result.items, meta: result.meta } : { data: result ?? null })),
    );
  }
}
