import { Column, Entity } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

export interface API {
  phase: string;
  key: string;
  secret: string;
}

@Entity()
export class Exapi extends Model implements API {

  // https://coinmarketcap.com/
  static EX_CMC = 'cmc';

  @Column()
  ex: string;

  @Column({nullable: true})
  phase: string;

  @Column()
  key: string;

  @Column({nullable: true})
  secret: string;

  @Column({nullable: true})
  memo: string;

  @Column({nullable: true})
  enabled: boolean;

  @Column({nullable: true})
  no: number;

  @Column({nullable: true})
  updatedAt: Date;
}


export class CreateExapiDto {
  ex: string;
  phase: string;
  key: string;
  secret: string;
  memo: string;
  enabled: boolean;
  no: number;
  updatedAt: Date;
}

export class UpdateExapiDto extends PartialType(CreateExapiDto) {
  phase: string;
  key: string;
  secret: string;
  memo: string;
  enabled: boolean;
  no: number;
  updatedAt: Date;
}
