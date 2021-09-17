import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Strategy, StrategyFilter } from '../../models/str/strategy';
import { HistoryStrategiesService } from './history-strategies.service';
import { StrategyHistory } from '../../models/str/strategy-history';

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);

  constructor(@InjectRepository(Strategy) protected repository: Repository<Strategy>,
              private historyStrategiesService: HistoryStrategiesService
  ) {
  }

  async completeStrategy(strategy: Strategy): Promise<void> {
    strategy.status = 'completed';
    strategy.completedAt = new Date();
    let strategyHistory = {...strategy} as StrategyHistory;
    strategyHistory.sid = strategy.id;
    delete strategyHistory.id;
    strategyHistory = await this.historyStrategiesService.create(strategyHistory);
    await this.remove(strategy.id);
    this.logger.log('complete Strategy: ' + strategy.id + ', history: ' + strategyHistory.id);
  }

  async tryInstantiateNext(strategy: Strategy, currentPrice: number): Promise<Strategy | null> {
    // this.logger.log('try instantiate next Strategy');
    return null;
  }


  async findOrInstantiateNext(strategy: Strategy, currentPrice: number): Promise<Strategy | null> {
    const {ex, side, symbol} = strategy;
    const oppositeSide = side === 'buy' ? 'sell' : 'buy';
    let next = await this.findByExSideSymbol(ex, oppositeSide, symbol);
    if (next) {
      const status1 = next.status;
      if (status1 !== 'placed' && status1 !== 'completed') {
        return next;
      }
    }
    if (!currentPrice) {
      this.logger.log('no currentPrice.');
      return null;
    }
    next = await this.tryInstantiateNext(strategy, currentPrice);
    return next;
  }

  findOne(id: number): Promise<Strategy> {
    return this.repository.findOne(id);
  }

  findAll(filter?: StrategyFilter): Promise<Strategy[]> {
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
      if (filter.status) {
        where.status = filter.status;
      }
    }
    return this.repository.find({
      where,
      order: {applyOrder: 'ASC'}
    });
  }

  findByExWithClientOrderId(ex: string): Promise<Strategy[]> {
    return this.repository.find({
      where: {
        ex,
        clientOrderId: Not(IsNull())
      }
    });
  }

  findByExAndClientOrderId(ex: string, clientOrderId: string): Promise<Strategy> {
    return this.repository.findOne({
      where: {
        ex,
        clientOrderId
      }
    });
  }

  findByExSideSymbol(ex: string, side: string, symbol: string): Promise<Strategy> {
    return this.repository.findOne({
      where: {
        ex,
        side,
        symbol
      }
    });
  }

  findAllToExecute(type: string = null): Promise<Strategy[]> {
    const where: any = {status: 'started'};
    if (type) {
      where.type = type;
    }
    return this.repository.find({
      where,
      order: {applyOrder: 'ASC'}
    });
  }

  async create(dto: Strategy): Promise<Strategy> {
    return this.repository.save(dto);
  }

  async update(id: number, dto: Strategy): Promise<void> {
    dto = {...dto};
    delete dto.id;
    delete dto.createdAt;
    delete dto.ex;
    delete dto.symbol;
    delete dto.baseCcy;
    delete dto.quoteCcy;
    delete dto.side;
    delete dto.type;
    delete dto.watchDirection;
    await this.repository.update(id, dto);
  }

  async saveMany(dtos: Strategy[]): Promise<Strategy[]> {
    return this.repository.save(dtos);
  }

  async setStatusStart(id: number): Promise<void> {
    const st = await this.repository.findOne(id);
    if (!st) {
      throw new Error('策略不存在');
    }
    if (st.status === 'completed') {
      throw new Error('策略已完成');
    }
    if ((st.tradeVolByValue && !st.tradeVol) || (!st.tradeVolByValue && !st.tradeVolPercent)) {
      throw new Error('未设置交易量');
    }
    if (!st.basePoint || !st.expectingPercent || !st.intenseWatchPercent || !st.mediumWatchPercent) {
      throw new Error('部分属性未设置');
    }

    await this.repository.update(id, {status: 'started'});
  }

  async setStatusPause(id: number): Promise<void> {
    const st = await this.repository.findOne(id);
    if (!st) {
      throw new Error('策略不存在');
    }
    if (st.status === 'completed') {
      throw new Error('策略已完成');
    }
    await this.repository.update(id, {status: 'paused'});
  }

  async clearPeak(id: number): Promise<void> {
    const st = await this.repository.findOne(id);
    if (!st) {
      throw new Error('策略不存在');
    }
    await this.repository.update(id, {
      peak: null,
      peakTime: null,
      valley: null,
      valleyTime: null,
      beyondExpect: false
    });
  }


  async pauseAll(type: string = null): Promise<void> {
    let sql = `update strategy set status='paused' where status='started'`;
    if (type) {
      sql += ` and type='${type}'`;
    }
    await this.repository.query(sql);
  }

  async resumeAll(type: string = null): Promise<void> {
    let sql = `update strategy set status='started' where status='paused'`;
    if (type) {
      sql += ` and type='${type}'`;
    }
    await this.repository.query(sql);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
