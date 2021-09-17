import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Command, Console, createSpinner } from 'nestjs-console';

import { User, CreateUserDto, UpdateUserDto, PasswordResetDto } from '../../models/sys/user';
import { UserAccountService } from '../user-account.service';
import { Result } from '../../models/result';


@Injectable()
@Console({
  command: 'user',
  description: 'UsersService'
})
export class UsersService extends UserAccountService {
  constructor(
    @InjectRepository(User)
    protected readonly usersRepository: Repository<User>,
  ) {
    super(usersRepository);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new User();
    user.username = createUserDto.username;
    user.password = this.hashPass(createUserDto.password);
    user.role = createUserDto.role;
    user.email = createUserDto.email;

    await this.usersRepository.save(user);
    delete user.password;
    return user;
  }

  @Command({
    command: 'create <username> <password> [role]',
    description: '创建用户'
  })
  async consoleCreate(username: string, password: string, role = 'admin'): Promise<void> {
    const spin = createSpinner();
    spin.start(`创建用户 ${username} `);

    const createUserDto = {username, password, role} as CreateUserDto;
    const user = await this.create(createUserDto);

    console.log(JSON.stringify(user, null, 2));

    spin.succeed('完成');
  }

  @Command({
    command: 'get <username>',
    description: '查询用户'
  })
  async consoleGetUser(username: string): Promise<void> {
    const spin = createSpinner();
    spin.start(`用户 ${username}`);

    const user = await this.findByUsername(username);

    console.log(JSON.stringify(user, null, 2));

    spin.succeed('完成');
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async update(id: number, dto: UpdateUserDto): Promise<void> {
    delete (dto as any).id;
    delete (dto as any).password;
    await this.usersRepository.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }


  async resetPass(passwordResetDto: PasswordResetDto): Promise<Result> {
    const {username, newPassword} = passwordResetDto;
    const password = this.hashPass(newPassword);
    await this.usersRepository.update({username}, {password});
    return Result.success();
  }
}
