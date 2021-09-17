import { Column, Entity, Index } from 'typeorm';
import { Model } from '../model';
import { PartialType } from '@nestjs/mapped-types';

@Entity()
@Index(['no'])
export class Ccy extends Model {

  @Column({unique: true})
  code: string;

  @Column()
  name: string;

  @Column({nullable: true})
  nameZh: string;

  @Column({nullable: true})
  slug: string;

  @Column({nullable: true})
  logoPath: string;

  // cmc rank
  @Column({nullable: true})
  no: number;

  @Column('boolean', {nullable: true})
  concerned: boolean;
}


export class CreateCcyDto {
  code: string;
  name: string;
  logoPath: string;
  no: number;
  concerned: boolean;
}

export class UpdateCcyDto extends PartialType(CreateCcyDto) {
  name: string;
  logoPath: string;
  no: number;
  concerned: boolean;
}

export class CcyFilter {
  code: string;
  name: string;
  concerned: boolean | string;
}
