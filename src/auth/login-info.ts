import { User } from '../models/sys/user';

export class LoginInfo {
  user: User;
  accessToken: string;
}
