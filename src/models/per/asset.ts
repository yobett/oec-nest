import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
@Index(['ex', 'ccy'], {unique: true})
export class Asset extends Model {

  @Column()
  ex: string;

  @Column()
  ccy: string;

  @Column('double')
  holding: number;

  @Column('double')
  frozen: number;

  @Column({nullable: true})
  lastSync: Date;

  price: number;
  holdingValue: number;
  frozenValue: number;
}


export class CreateAssetDto {
  ex: string;
  ccy: string;
  holding: number;
  frozen: number;
  lastSync?: Date;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  holding: number;
  frozen: number;
  lastSync?: Date;
}
