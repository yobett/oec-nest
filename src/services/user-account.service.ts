import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../models/sys/user';
import { Config } from '../common/config';


@Injectable()
export class UserAccountService {
  constructor(
    @InjectRepository(User)
    protected readonly usersRepository: Repository<User>,
  ) {
  }

  protected saltPass(pass) {
    return pass + '.' + Config.SiteSalt;
  }

  protected hashPass(pass) {
    return bcrypt.hashSync(this.saltPass(pass), 10);
  }

  protected checkPass(pass, hashedPass): boolean {
    return bcrypt.compareSync(this.saltPass(pass), hashedPass);
  }

  async authenticate(username: string, password: string): Promise<User> {
    if (!password) {
      return null;
    }
    const user: User = await this.findByUsername(username, {select: ['password']});
    if (!user) {
      return null;
    }
    const match = this.checkPass(password, user.password);
    if (match) {
      return this.findByUsername(username);
    }
    return null;
  }

  findOne(id: number): Promise<User> {
    return this.usersRepository.findOne(id);
  }

  findByUsername(username: string, options?): Promise<User> {
    return this.usersRepository.findOne({username}, options);
  }

}
