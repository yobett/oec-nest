import { Column, Entity } from 'typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Model } from '../model';

@Entity()
export class Exch extends Model {

  static CODE_BA = 'ba'; // 币安
  static CODE_OE = 'oe'; // 欧易
  static CODE_HB = 'hb'; // 火币

  @Column({unique: true})
  code: string;

  @Column()
  name: string;

}


export class CreateExchDto {
  code: string;
  name: string;
}

export class UpdateExchDto extends PartialType(CreateExchDto) {
  name: string;
}
