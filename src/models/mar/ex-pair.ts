import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';


export interface PairBQ {
  baseCcy: string;
  quoteCcy: string;
}

@Entity()
@Index(['baseCcy', 'quoteCcy'], {unique: true})
@Index(['quoteCcy'])
@Index(['createdAt'])
@Index(['baSymbol'], {unique: true})
@Index(['oeSymbol'], {unique: true})
@Index(['hbSymbol'], {unique: true})
export class ExPair extends Model implements PairBQ {

  @Column()
  baseCcy: string;

  @Column()
  quoteCcy: string;

  @Column('boolean', {nullable: true})
  concerned: boolean;

  @Column({nullable: true})
  baSymbol: string;

  @Column({nullable: true})
  oeSymbol: string;

  @Column({nullable: true})
  hbSymbol: string;
}


export class CreateExPairDto {
  baseCcy: string;
  quoteCcy: string;
  concerned: boolean;
  baSymbol: string;
  oeSymbol: string;
  hbSymbol: string;
}

export class UpdateExPairDto extends PartialType(CreateExPairDto) {
}

export class ExPairFilter implements PairBQ {
  ex: string;
  baseCcy: string;
  quoteCcy: string;
  concerned: boolean | string;
}

export interface ExchangePair extends PairBQ {
  ex: string;
  symbol: string;
}

export interface ExchangePairsResult {
  ccy: string;
  asBase: ExchangePair[];
  asQuote: ExchangePair[];
}
