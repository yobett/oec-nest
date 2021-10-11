import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CountList, CountListResult, ListResult, ValueResult } from '../../models/result';
import { HistoryStrategiesService } from '../../services/str/history-strategies.service';
import { StrategyHistory } from '../../models/str/strategy-history';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { QueryParams } from '../../models/query-params';


@Controller('str/hist-strategies')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class StrategyHistoryController {
  constructor(private service: HistoryStrategiesService) {

  }

  @Get()
  async findAll(): Promise<ListResult<StrategyHistory>> {
    const list: StrategyHistory[] = await this.service.findAll();
    return ListResult.list(list);
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<StrategyHistory>> {
    const {pager, filter, sorter} = query;
    const cl: CountList<StrategyHistory> = await this.service.page(pager, filter, sorter);
    return CountListResult.cl(cl);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<StrategyHistory>> {
    const value: StrategyHistory = await this.service.findOne(+id);
    return ValueResult.value(value);
  }

}
