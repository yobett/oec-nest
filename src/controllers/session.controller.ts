import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LocalAuthGuard } from '../auth/guards/local-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginInfo } from '../auth/login-info';
import { ValueResult } from '../models/result';
import { User } from '../models/sys/user';

@Controller('session')
export class SessionController {
  constructor(private readonly authService: AuthService) {
  }

  @UseGuards(LocalAuthGuard)
  @Post()
  async login(@Request() req): Promise<ValueResult<LoginInfo>> {
    const li = await this.authService.login(req.user);
    return ValueResult.value(li);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserinfo(@Request() req): Promise<ValueResult<User>> {
    return ValueResult.value(req.user);
  }
}
