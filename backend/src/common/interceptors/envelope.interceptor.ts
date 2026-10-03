import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

import { langOf, translateDeep } from '../i18n/i18n.js';
import { Paginated } from '../pagination.js';

/** Wraps successful responses as `{ data }`, or `{ data, meta }` for paginated lists, and translates platform text. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const lang = langOf(ctx.switchToHttp().getRequest());
    return next.handle().pipe(
      map((result) => (result instanceof Paginated ? { data: result.items, meta: result.meta } : { data: result ?? null })),
      // Messages, labels and notification text in the request language (Urdu dictionary).
      map((body) => translateDeep(body, lang)),
    );
  }
}
