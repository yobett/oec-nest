import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccountModule } from '../services/account.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { Config } from '../common/config';

@Module({
  imports: [
    AccountModule,
    PassportModule,
    JwtModule.register({
      secret: Config.JwtSecret,
      signOptions: {expiresIn: Config.JwtExpiresIn},
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {
}
