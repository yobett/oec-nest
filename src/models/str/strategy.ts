import { Column, Entity } from 'typeorm';
import { Model } from '../model';

@Entity()
export class Strategy extends Model {
  static TypeLB = 'LB';
  static TypeHS = 'HS';
  static TypeLS = 'LS';
  static TypeHB = 'HB';

  static ExecutorPr = 'pr';
  static ExecutorWs = 'ws';


  constructor(type: string) {
    super();
    this.type = type;
    if (this.type === Strategy.TypeHS) {
      this.watchDirection = 'up';
      this.side = 'sell';
    } else if (this.type === Strategy.TypeHB) {
      this.watchDirection = 'up';
      this.side = 'buy';
      this.updateBasePoint = true;
    } else if (this.type === Strategy.TypeLS) {
      this.watchDirection = 'down';
      this.side = 'sell';
      this.updateBasePoint = true;
    } else if (this.type === Strategy.TypeLB) {
      this.watchDirection = 'down';
      this.side = 'buy';
    }
  }

  @Column()
  ex: string;
  @Column()
  symbol: string;
  @Column()
  baseCcy: string;
  @Column()
  quoteCcy: string;
  @Column()
  type: string; // LB 低买, HS 高卖, LS 低卖（止损）, HB 高买（跟涨）
  @Column()
  side: 'buy' | 'sell';
  @Column()
  watchDirection: 'up' | 'down';
  @Column({nullable: true})
  applyOrder: number;

  @Column({type: 'double', nullable: true})
  basePoint: number;

  @Column({type: 'double', nullable: true})
  expectingPercent: number;
  @Column({type: 'double', nullable: true})
  expectingPoint: number;

  @Column({type: 'double', nullable: true})
  drawbackPercent: number;
  @Column({type: 'double', nullable: true})
  tradingPoint: number;

  @Column({type: 'double', nullable: true})
  tradeVol: number; // base for sell, quote for buy
  @Column({type: 'double', nullable: true})
  tradeVolPercent: number; // base for sell, quote for buy
  @Column()
  tradeVolByValue: boolean;

  @Column({type: 'double', nullable: true})
  peak: number;
  @Column({nullable: true})
  peakTime: Date;

  @Column({type: 'double', nullable: true})
  valley: number;
  @Column({nullable: true})
  valleyTime: Date;

  @Column({nullable: true})
  beyondExpect: boolean;

  @Column({nullable: true})
  lastCheckAt: Date;
  @Column({type: 'double', nullable: true})
  lastCheckPrice: number;

  @Column({nullable: true})
  orderPlacedAt: Date;
  @Column({nullable: true})
  clientOrderId: string;

  @Column({nullable: true})
  completedAt: Date;

  @Column({nullable: true})
  autoStartNext: boolean;

  @Column({nullable: true})
  updateBasePoint: boolean;

  @Column()
  watchLevel: 'loose' | 'medium' | 'intense';
  @Column()
  status: 'initial' | 'started' | 'paused' | 'placed' | 'completed';

  @Column({nullable: true})
  executor: string;

  static setExpectingPoint(strategy: Strategy): void {
    const sign = strategy.watchDirection === 'up' ? 1 : -1;
    strategy.expectingPoint = strategy.basePoint * (100 + strategy.expectingPercent * sign) / 100.0;
  }
}

export interface StrategyFilter {
  type?: string;
  ex?: string;
  side?: string;
  status?: string;
}
