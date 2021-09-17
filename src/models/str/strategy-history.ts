import { Column, Entity } from 'typeorm';
import { Strategy } from './strategy';

@Entity()
export class StrategyHistory extends Strategy {

  @Column({nullable: true})
  sid: number;
}
