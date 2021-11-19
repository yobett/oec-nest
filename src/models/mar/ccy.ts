import { Column, Entity, Index } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
@Index(['code'], {unique: true})
@Index(['name'])
@Index(['no'])
@Index(['cmcAddedDate'])
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

  @Column({nullable: true})
  cmcAddedDate: Date;
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
