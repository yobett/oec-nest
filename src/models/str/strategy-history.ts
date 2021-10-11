import { Column, Entity, Index } from 'typeorm';
import { Strategy } from './strategy';

@Entity()
@Index(['orderPlacedAt'])
export class StrategyHistory extends Strategy {

  @Column({nullable: true})
  sid: number;
}

export interface StrategyHistoryFilter {
  type?: string;
  ex?: string;
  side?: string;
  baseCcy?: string;
  orderPlacedDateTo?: string; // 2021-10-11
}
