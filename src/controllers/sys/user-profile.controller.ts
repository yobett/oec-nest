import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../services/sys/users.service';
import { MyPasswordResetDto, User } from '../../models/sys/user';
import { Result } from '../../models/result';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('sys/user-profile')
@UseGuards(JwtAuthGuard)
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {
  }

  @Post('resetPass')
  async resetPass(@CurrentUser() currentUser: User,
                  @Body() dto: MyPasswordResetDto): Promise<Result> {
    if (!currentUser) {
      return Result.fail('未登录');
    }
    const username = currentUser.username;
    const {password, newPassword} = dto;
    const user = await this.usersService.authenticate(username, password);
    if (!user) {
      return Result.fail('原密码错误');
    }

    return this.usersService.resetPass({username, newPassword});
  }
}
