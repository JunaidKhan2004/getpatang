import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../notifications/mail.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { createOtpChannel, OTP_CHANNEL } from './otp/otp-channel.js';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    {
      provide: OTP_CHANNEL,
      inject: [ConfigService, MailService],
      useFactory: (config: ConfigService, mail: MailService) => createOtpChannel(config.getOrThrow<string>('OTP_CHANNEL'), mail),
    },
  ],
})
export class AuthModule {}
