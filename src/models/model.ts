import { PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumn } from 'typeorm/decorator/columns/CreateDateColumn';

export abstract class Model {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt?: Date;
}
