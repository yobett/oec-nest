import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { StrategyExecutorService } from '../services/str/strategy-executor.service';
import { Config } from '../common/config';

const StrategyWatch = Config.StrategyWatch.CheckIntervalMinutes;


@Injectable()
export class StrategyTasks {
  private readonly logger = new Logger(StrategyTasks.name);

  constructor(private strategyExecutorService: StrategyExecutorService) {
  }


  @Cron(`0 */${StrategyWatch} * * * *`, {name: 'Check All Strategies'})
  async checkAllStrategies() {
    this.logger.log('检查并执行策略 ...');
    await this.strategyExecutorService.executeAll({context: 'job'});
    this.logger.log('检查并执行策略完成');
  }

}
