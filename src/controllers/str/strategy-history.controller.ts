import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListResult, ValueResult } from '../../models/result';
import { HistoryStrategiesService } from '../../services/str/history-strategies.service';
import { StrategyHistory } from '../../models/str/strategy-history';


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

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<StrategyHistory>> {
    const value: StrategyHistory = await this.service.findOne(+id);
    return ValueResult.value(value);
  }

}
