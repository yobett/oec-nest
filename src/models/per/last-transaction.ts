import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
@Index(['baseCcy', 'quoteCcy'], {unique: true})
export class LastTransaction extends Model {

  @Column({nullable: true})
  oid: number; // order.id

  @Column()
  baseCcy: string;

  @Column()
  quoteCcy: string;

  // buy, sell
  @Column()
  side: string;

  @Column('double', {nullable: true})
  avgPrice: number;

  @Column('double', {nullable: true})
  execQty: number;

  @Column('double', {nullable: true})
  quoteAmount: number;

  @Column({nullable: true})
  ex: string;

  @Column('decimal', {precision: 13, nullable: true})
  updateTs: number;
}

export class CreateLastTransDto {
  oid: number;
  baseCcy: string;
  quoteCcy: string;
  side: string;
  avgPrice: number;
  execQty: number;
  quoteAmount: number;
  ex?: string;
  updateTs: number;
}

export class UpdateLastTransDto extends PartialType(CreateLastTransDto) {
  oid: number;
  side: string;
  avgPrice: number;
  execQty: number;
  quoteAmount: number;
  ex?: string;
  updateTs: number;
}
