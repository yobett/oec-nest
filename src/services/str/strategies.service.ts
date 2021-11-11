import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpdateResult } from 'typeorm/query-builder/result/UpdateResult';
import { Observable } from 'rxjs';
import { Strategy, StrategyFilter } from '../../models/str/strategy';
import { HistoryStrategiesService } from './history-strategies.service';
import { StrategyHistory } from '../../models/str/strategy-history';
import { RunningStrategiesHolder, StrategyChange } from './running-strategies-holder';

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);

  runningStrategiesHolder: RunningStrategiesHolder = new RunningStrategiesHolder();

  constructor(@InjectRepository(Strategy) protected repository: Repository<Strategy>,
              private historyStrategiesService: HistoryStrategiesService
  ) {
    setTimeout(() => {
      this.loadRunningStrategies().catch(console.error);
    }, 200);
  }

  async loadRunningStrategies(): Promise<void> {
    this.logger.log(`reload running strategies ...`);
    const strategies = await this.findAllToExecute();
    this.runningStrategiesHolder.refresh(strategies)
  }

  getRunningStrategies(type: string = null): Strategy[] {
    return this.runningStrategiesHolder.strategies.filter(s => !type || s.type === type);
  }

  watchRunningStrategiesChange(): Observable<StrategyChange> {
    return this.runningStrategiesHolder.changeSubject;
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
    if (!strategy.autoStartNext) {
      return null;
    }
    const {
      type, ex, symbol, baseCcy, quoteCcy, applyOrder,
      basePoint, expectingPercent, drawbackPercent,
      tradeVolPercent, tradeVolByValue, tradeVol, executor
    } = strategy;

    let nextType = type;
    switch (type) {
      case Strategy.TypeLB:
        nextType = Strategy.TypeHS;
        break;
      case Strategy.TypeHS:
        nextType = Strategy.TypeLB;
        break;
      case Strategy.TypeLS:
        nextType = Strategy.TypeHB;
        break;
      case Strategy.TypeHB:
        nextType = Strategy.TypeLS;
        break;
    }
    const next = new Strategy(nextType);
    Object.assign(next, {
      ex, symbol, baseCcy, quoteCcy, applyOrder,
      basePoint, expectingPercent, drawbackPercent,
      tradeVolPercent, tradeVolByValue, tradeVol, executor
    });

    next.basePoint = currentPrice;
    next.expectingPoint = basePoint * (100 + expectingPercent * (next.watchDirection === 'up' ? 1 : -1)) / 100.0;
    next.watchLevel = 'loose';
    next.status = 'started';

    await this.create(next);
    return next;
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

  async findAll(filter?: StrategyFilter): Promise<Strategy[]> {
    let allRunning = true;
    const where: any = {};
    if (filter) {
      if (filter.type) {
        where.type = filter.type;
        allRunning = false;
      }
      if (filter.ex) {
        where.ex = filter.ex;
        allRunning = false;
      }
      if (filter.side) {
        where.side = filter.side;
        allRunning = false;
      }
      if (filter.status) {
        where.status = filter.status;
        if (filter.status !== 'started') {
          allRunning = false;
        }
      }
    }
    const strategies = await this.repository.find({
      where,
      order: {applyOrder: 'ASC'}
    });
    if (allRunning) {
      const running = strategies.filter(s => s.status === 'started');
      this.runningStrategiesHolder.refresh(running);
    }
    return strategies;
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
    const strategy = await this.repository.save(dto);
    this.runningStrategiesHolder.addOrUpdate(strategy);
    return strategy;
  }

  async update0(id: number, dto: Strategy): Promise<UpdateResult> {
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
    return this.repository.update(id, dto);
  }

  async update(id: number, dto: Strategy): Promise<void> {
    const updateResult: UpdateResult = await this.update0(id, dto);
    // this.logger.log(`update affected: ${updateResult.affected}`);
    if (updateResult.affected && updateResult.affected > 0) {
      const strategy = await this.repository.findOne(id);
      this.runningStrategiesHolder.addOrUpdate(strategy);
    }
  }

  async saveMany(dtos: Strategy[]): Promise<Strategy[]> {
    const strategies = await this.repository.save(dtos);
    await this.loadRunningStrategies();
    return strategies;
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
    if (!st.basePoint || !st.expectingPercent) {
      throw new Error('未设置基点/期望');
    }

    await this.repository.update(id, {status: 'started'});
    st.status = 'started';
    this.runningStrategiesHolder.addOrUpdate(st);
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
    this.runningStrategiesHolder.remove(id);
  }

  async clearPeak(id: number): Promise<void> {
    const st = await this.repository.findOne(id);
    if (!st) {
      throw new Error('策略不存在');
    }
    const updater: QueryDeepPartialEntity<Strategy> = {
      peak: null,
      peakTime: null,
      valley: null,
      valleyTime: null,
      beyondExpect: false
    };
    await this.repository.update(id, updater);
    this.runningStrategiesHolder.addOrUpdate(Object.assign(st, updater));
  }


  async pauseAll(type: string = null): Promise<void> {
    let sql = `update strategy set status='paused' where status='started'`;
    if (type) {
      sql += ` and type='${type}'`;
    }
    await this.repository.query(sql);
    if (!type) {
      this.runningStrategiesHolder.refresh([]);
    } else {
      this.runningStrategiesHolder.removeType(type);
    }
  }

  async resumeAll(type: string = null): Promise<void> {
    let sql = `update strategy set status='started' where status='paused'`;
    if (type) {
      sql += ` and type='${type}'`;
    }
    await this.repository.query(sql);
    await this.loadRunningStrategies();
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
    this.runningStrategiesHolder.remove(id);
  }
}
