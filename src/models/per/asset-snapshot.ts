import { Column, Entity, Index } from 'typeorm';
import { Model } from '../model';

@Entity()
@Index(['ts', 'ccy'], {unique: true})
export class AssetSnapshot extends Model {
  static CcyAll = '-all-';

  @Column('decimal', {precision: 13})
  ts: number;
  @Column()
  hour: number; // 0-23

  @Column()
  ccy: string; // BTC,ETH,...,all
  @Column('double')
  holding: number;

  @Column('double')
  price: number;
  @Column('double')
  holdingValue: number;
}

export interface AssetSnapshotQueryForm {
  ccy: string;
  limit: number;
  ts?: number;
  olderThan?: number;
  newerThan?: number;
  hour?: number;
  hourMod?: number;
}
