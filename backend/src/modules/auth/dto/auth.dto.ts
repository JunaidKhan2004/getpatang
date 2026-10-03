import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

// Keep in sync with mobile/lib/core/utils/validators.dart and web/src/lib/validation.ts
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE = 'Use 8–72 characters with at least one letter and one number';
export const PK_PHONE_RULE = /^(\+92|0)3\d{9}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Ali Raza' })
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Full name must be 2–80 characters' })
  fullName: string;

  @ApiProperty({ example: 'ali@example.com' })
  @Transform(lowerTrim)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '03001234567' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(PK_PHONE_RULE, { message: 'Use the format 03XX XXXXXXX' })
  phone?: string;

  @ApiProperty({ example: 'kites2027' })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email or Pakistani mobile number', example: 'ali@example.com' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Enter your email or phone number' })
  @MaxLength(254)
  identifier: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(72)
  password: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @Transform(lowerTrim)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code: string;
}

export class ResendOtpDto {
  @ApiProperty()
  @Transform(lowerTrim)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(lowerTrim)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken: string;
}

/** Normalises 03XXXXXXXXX to +923XXXXXXXXX so each number is stored one way. */
export function normalizePkPhone(phone: string): string {
  const compact = phone.replace(/[\s-]/g, '');
  return compact.startsWith('0') ? `+92${compact.slice(1)}` : compact;
}
