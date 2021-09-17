import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Exch, UpdateExchDto } from '../../models/sys/exch';
import { Command, Console, createSpinner } from 'nestjs-console';


@Injectable()
@Console({
  command: 'exch',
  description: 'ExchsService'
})
export class ExchsService {
  constructor(
    @InjectRepository(Exch)
    protected readonly exchsRepository: Repository<Exch>,
  ) {
  }

  findOne(id: number): Promise<Exch> {
    return this.exchsRepository.findOne(id);
  }

  findByCode(code: string, options?): Promise<Exch> {
    return this.exchsRepository.findOne({code}, options);
  }

  findAll(): Promise<Exch[]> {
    return this.exchsRepository.find();
  }

  async update(id: number, dto: UpdateExchDto): Promise<void> {
    await this.exchsRepository.update(id, dto);
  }


  @Command({
    command: 'init',
    description: '初始化交易所记录'
  })
  async initialize(): Promise<void> {
    const spin = createSpinner();
    spin.start(`初始化交易所记录 `);

    const exchs = await await this.exchsRepository.find();
    if (exchs.length > 0) {
      console.log(JSON.stringify(exchs, null, 2));
      spin.warn('已经初始化');
      return;
    }

    const exchs2 = await this.exchsRepository.save([
      {code: 'ba', name: 'BA'},
      {code: 'oe', name: 'OE'},
      {code: 'hb', name: 'HB'},
    ]);

    console.log(JSON.stringify(exchs2, null, 2));
    spin.succeed('完成');
  }
}
