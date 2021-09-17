import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../models/sys/user';
import { UserAccountService } from './user-account.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserAccountService],
  exports: [UserAccountService, TypeOrmModule]
})
export class AccountModule {
}
