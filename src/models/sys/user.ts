import { Column, Entity } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
export class User extends Model {

  @Column({unique: true})
  username: string;

  @Column({select: false})
  password?: string;

  @Column({nullable: true})
  role?: string;

  @Column({nullable: true})
  email?: string;
}

export class CreateUserDto {
  username: string;
  password: string;
  role: string;
  email: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  role: string;
  email: string;
}

export class PasswordResetDto {
  username: string;
  newPassword: string;
}

export class MyPasswordResetDto {
  password: string;
  newPassword: string;
}
