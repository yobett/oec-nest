import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as moment from 'moment';
import { StrategyHistory, StrategyHistoryFilter } from '../../models/str/strategy-history';
import { Pager, Sorter } from '../../models/query-params';
import { CountList } from '../../models/result';

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

  async page(pager: Pager, filter?: StrategyHistoryFilter, sorter?: Sorter): Promise<CountList<StrategyHistory>> {
    const where: any = {};
    if (filter) {
      if (filter.type) {
        where.type = filter.type;
      }
      if (filter.ex) {
        where.ex = filter.ex;
      }
      if (filter.side) {
        where.side = filter.side;
      }
      if (filter.baseCcy) {
        where.baseCcy = filter.baseCcy;
      }
      if (filter.orderPlacedDateTo) {
        const mom = moment(filter.orderPlacedDateTo).add(1, 'day');
        where.orderPlacedAt = LessThan(mom.toDate());
      }
    }
    const order: any = (sorter && sorter.sort) ? {[sorter.sort]: sorter.sortDir} : {orderPlacedAt: 'DESC'};
    const [list, count] = await this.repository.findAndCount({
      where,
      order,
      skip: pager.skip,
      take: pager.pageSize
    });

    return {list, count};
  }

  async create(dto: StrategyHistory): Promise<StrategyHistory> {
    return this.repository.save(dto);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
