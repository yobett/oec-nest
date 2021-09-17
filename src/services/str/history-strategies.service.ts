import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategyHistory } from '../../models/str/strategy-history';

@Injectable()
export class HistoryStrategiesService {

  constructor(
    @InjectRepository(StrategyHistory) protected repository: Repository<StrategyHistory>
  ) {
  }

  findOne(id: number): Promise<StrategyHistory> {
    return this.repository.findOne(id);
  }

  findAll(): Promise<StrategyHistory[]> {
    return this.repository.find({
      order: {completedAt: 'ASC'}
    });
  }

  findAllBy(cond: any): Promise<StrategyHistory[]> {
    return this.repository.find({
      where: cond,
      order: {completedAt: 'ASC'}
    });
  }

  async create(dto: StrategyHistory): Promise<StrategyHistory> {
    return this.repository.save(dto);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
