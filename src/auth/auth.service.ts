import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../models/sys/user';
import { UserAccountService } from '../services/user-account.service';
import { LoginInfo } from './login-info';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly userAccountService: UserAccountService,
    private readonly jwtService: JwtService,
  ) {
  }


  async validateUser(username: string, password: string): Promise<any> {
    return this.userAccountService.authenticate(username, password);
  }

  async login(user: User): Promise<LoginInfo> {
    const payload: JwtPayload = {username: user.username, userId: user.id, role: user.role};
    const token = this.jwtService.sign(payload);
    const li = new LoginInfo();
    li.user = user;
    li.accessToken = token;
    return li;
  }
}
