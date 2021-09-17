import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, } from '@nestjs/common';
import { UsersService } from '../../services/sys/users.service';
import { CreateUserDto, PasswordResetDto, UpdateUserDto, User } from '../../models/sys/user';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, Result, ValueResult } from '../../models/result';

@Controller('sys/users')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }

  @Get()
  async findAll(): Promise<ListResult<User>> {
    const list: User[] = await this.usersService.findAll();
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<User>> {
    const value: User = await this.usersService.findOne(+id);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<ValueResult<User>> {
    const value: User = await this.usersService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<Result> {
    await this.usersService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.usersService.remove(+id);
    return Result.success();
  }

  @Post('resetPass')
  resetPass(@Body() dto: PasswordResetDto): Promise<Result> {
    return this.usersService.resetPass(dto);
  }
}
