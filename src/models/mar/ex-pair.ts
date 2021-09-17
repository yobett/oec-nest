import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
@Index(['baseCcy', 'quoteCcy'], {unique: true})
@Index(['quoteCcy'])
@Index(['baSymbol'], {unique: true})
@Index(['oeSymbol'], {unique: true})
@Index(['hbSymbol'], {unique: true})
export class ExPair extends Model {

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

export class ExPairFilter {
  ex: string;
  baseCcy: string;
  quoteCcy: string;
  concerned: boolean | string;
}

export interface ExchangePair {
  ex: string;
  baseCcy: string;
  quoteCcy: string;
  symbol: string;
}

export interface ExchangePairsResult {
  ccy: string;
  asBase: ExchangePair[];
  asQuote: ExchangePair[];
}
