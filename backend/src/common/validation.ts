import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';

import { AppException, FieldError } from './errors/app.exception.js';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).slice(0, 1).map((message) => ({ field, message }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Strips unknown fields, converts types and reports errors per field. */
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  exceptionFactory: (errors) =>
    new AppException(
      'VALIDATION_FAILED',
      'Some fields need your attention.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      flatten(errors),
    ),
});
