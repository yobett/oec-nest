import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
@Index(['ex', 'orderId'], {unique: true})
@Index(['ex', 'pairSymbol'])
@Index(['baseCcy', 'quoteCcy'])
@Index(['createTs'])
@Index(['updateTs'])
export class SpotOrder extends Model {

  @Column()
  ex: string;

  @Column()
  pairSymbol: string;

  @Column()
  baseCcy: string;

  @Column()
  quoteCcy: string;

  @Column()
  orderId: string;

  @Column()
  clientOrderId: string;

  // buy, sell
  @Column()
  side: string;

  // market：市价单
  // limit：限价单
  // post_only：只做maker单
  // fok：全部成交或立即取消
  // ioc：立即成交并取消剩余
  @Column()
  type: string;

  // filled, canceled
  @Column()
  status: string;

  @Column('double', {nullable: true})
  askPrice: number;

  @Column('double', {nullable: true})
  askQty: number;

  @Column('double', {nullable: true})
  avgPrice: number;

  // base amount
  @Column('double', {nullable: true})
  execQty: number;

  @Column('double', {nullable: true})
  quoteAmount: number;

  @Column('decimal', {precision: 13})
  createTs: number;

  @Column('decimal', {precision: 13, nullable: true})
  updateTs: number;


  static genClientOrderId(side: string, prefix: string): string {
    const ts = new Date().getTime();
    const tst = ts % 100_000_000;
    const s = side === 'buy' ? 'b' : 's';
    return `${prefix}${s}${tst}`;
  }
}


export class CreateSpotOrderDto {
  ex: string;
  pairSymbol: string;
  baseCcy: string;
  quoteCcy: string;
  orderId: string;
  clientOrderId: string;
  side: string;
  type: string;
  status: string;
  askPrice: number;
  askQty: number;
  avgPrice: number;
  execQty: number;
  quoteAmount: number;
  createTs: number;
  updateTs: number;
}

export class UpdateSpotOrderDto extends PartialType(CreateSpotOrderDto) {
  type: string;
  status: string;
  askPrice: number;
  askQty: number;
  avgPrice: number;
  execQty: number;
  quoteAmount: number;
  updateTs: number;
}

export interface SpotOrderFilter {
  ex?: string;
  pairSymbolLike?: string;
  baseCcy?: string;
  quoteCcy?: string;
}

export interface OrderTimeLineQueryForm {
  limit: number;
  ex?: string;
  olderThan?: number; // createTs
}
