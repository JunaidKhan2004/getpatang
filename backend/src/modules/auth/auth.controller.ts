import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser, Public, ReqMeta, type RequestMeta } from '../../common/auth/decorators.js';
import { AuthService } from './auth.service.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';

/** Stricter limit for endpoints that guess passwords or codes, or send messages. */
const SENSITIVE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(SENSITIVE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and send an email verification code' })
  register(@Body() dto: RegisterDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.register(dto, meta);
  }

  @Public()
  @Throttle(SENSITIVE)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the account with the emailed code; returns a session' })
  verifyOtp(@Body() dto: VerifyOtpDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.verifyAccount(dto, meta);
  }

  @Public()
  @Throttle(SENSITIVE)
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto);
  }

  @Public()
  @Throttle(SENSITIVE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email or phone and password' })
  login(@Body() dto: LoginDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.login(dto, meta);
  }

  @Public()
  @Throttle(SENSITIVE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset code (same response whether or not the email exists)' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.forgotPassword(dto, meta);
  }

  @Public()
  @Throttle(SENSITIVE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password with the reset code; signs out all devices' })
  resetPassword(@Body() dto: ResetPasswordDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.resetPassword(dto, meta);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair (rotation)' })
  refresh(@Body() dto: RefreshTokenDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.refresh(dto.refreshToken, meta);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshTokenDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.logout(user.id, dto.refreshToken, meta);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
