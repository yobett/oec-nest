import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PriceMonitorService } from '../services/mar/price-monitor.service';
import { Config } from '../common/config';

const {IntervalMinutes} = Config.PriceMonitorConfig;

@Injectable()
export class PriceMonitorTasks {
  private readonly logger = new Logger(PriceMonitorTasks.name);

  constructor(private priceMonitorService: PriceMonitorService) {
  }


  @Cron(`0 3-58/${IntervalMinutes} * * * *`, {name: 'Check Quotes'})
  async checkQuotes() {
    this.logger.log('查询币价 ...');
    await this.priceMonitorService.checkPricesAndNotifyIfNecessary();
    this.logger.log('查询币价完成');
  }

}
