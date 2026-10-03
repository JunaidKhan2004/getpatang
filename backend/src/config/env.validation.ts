import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  PORT = 4000;

  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  @IsNotEmpty()
  DATABASE_URL: string;

  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @Matches(/^\d+[smhd]$/, { message: 'JWT_ACCESS_TTL must look like 15m, 1h or 30s' })
  JWT_ACCESS_TTL = '15m';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @MinLength(32)
  OTP_SECRET: string;

  @IsIn(['console', 'email', 'sms'])
  OTP_CHANNEL: 'console' | 'email' | 'sms' = 'console';

  @IsIn(['console', 'smtp'])
  MAIL_TRANSPORT: 'console' | 'smtp' = 'console';

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @Type(() => Number)
  @IsInt()
  SMTP_PORT = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsString()
  MAIL_FROM = 'Kite Platform <no-reply@kiteplatform.local>';

  /** Used for links in emails. */
  @IsString()
  WEB_ORIGIN = 'http://localhost:3000';

  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsOptional()
  @IsString()
  PUBLIC_API_ORIGIN?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;
}

/** Fails fast at startup when configuration is missing or unsafe. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const lines = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new Error(`Invalid environment configuration:\n - ${lines.join('\n - ')}`);
  }
  if (env.NODE_ENV === 'production' && process.env.THROTTLE_DISABLED === 'true') {
    throw new Error('THROTTLE_DISABLED is for automated tests only and is not allowed in production.');
  }
  if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
    throw new Error('MAIL_TRANSPORT=smtp needs SMTP_HOST (and usually SMTP_USER / SMTP_PASS).');
  }
  if (env.OTP_CHANNEL === 'email' && env.MAIL_TRANSPORT !== 'smtp') {
    throw new Error('OTP_CHANNEL=email needs MAIL_TRANSPORT=smtp so codes are actually delivered.');
  }
  if (env.NODE_ENV === 'production' && env.MAIL_TRANSPORT === 'console') {
    throw new Error('MAIL_TRANSPORT=console only logs emails and is not allowed in production.');
  }
  if (env.NODE_ENV === 'production' && env.OTP_CHANNEL === 'console') {
    throw new Error('OTP_CHANNEL=console prints codes to the log and is not allowed in production.');
  }
  return env;
}
