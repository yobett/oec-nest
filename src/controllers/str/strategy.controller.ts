import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BaseQuoteStrategyCounts, StrategiesService } from '../../services/str/strategies.service';
import { ListResult, Result, ValueResult } from '../../models/result';
import { Strategy, StrategyFilter } from '../../models/str/strategy';
import { StrategyExecutionOptions, StrategyExecutorService } from '../../services/str/strategy-executor.service';


@Controller('str/strategies')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class StrategyController {
  constructor(private strategiesService: StrategiesService,
              private executorsService: StrategyExecutorService) {

  }

  @Get()
  async findAll(@Query() filter: StrategyFilter): Promise<ListResult<Strategy>> {
    const list: Strategy[] = await this.strategiesService.findAll(filter);
    return ListResult.list(list);
  }

  @Get('type/:type')
  async findByType(@Param('type') type: string,
                   @Query() filter: StrategyFilter): Promise<ListResult<Strategy>> {
    filter.type = type;
    const list: Strategy[] = await this.strategiesService.findAll(filter);
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: number): Promise<ValueResult<Strategy>> {
    const value: Strategy = await this.strategiesService.findOne(+id);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: Strategy): Promise<ValueResult<Strategy>> {
    const value: Strategy = await this.strategiesService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() dto: Strategy): Promise<Result> {
    await this.strategiesService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<Result> {
    await this.strategiesService.remove(+id);
    return Result.success();
  }

  @Post('saveMany')
  async saveMany(@Body() strategies: Strategy[]): Promise<ListResult<Strategy>> {
    const s = await this.strategiesService.saveMany(strategies);
    return ListResult.list(s);
  }

  @Post(':id/status/:status')
  async setStatus(@Param('id') id: number,
                  @Param('status') status: string): Promise<Result> {
    if (status === 'started') {
      await this.strategiesService.setStatusStart(+id);
    } else if (status === 'paused') {
      await this.strategiesService.setStatusPause(+id);
    } else {
      throw new Error('参数错误，status=' + status);
    }
    return Result.success();
  }

  @Post(':id/clearPeak')
  async clearPeak(@Param('id') id: number): Promise<Result> {
    await this.strategiesService.clearPeak(+id);
    return Result.success();
  }

  @Post('pauseAll')
  async pauseAll(): Promise<Result> {
    await this.strategiesService.pauseAll();
    return Result.success();
  }

  @Post('pause/type/:type')
  async pauseForType(@Param('type') type: string): Promise<Result> {
    await this.strategiesService.pauseAll(type);
    return Result.success();
  }

  @Post('resumeAll')
  async resumeAll(): Promise<Result> {
    await this.strategiesService.resumeAll();
    return Result.success();
  }

  @Post('resume/type/:type')
  async resumeForType(@Param('type') type: string): Promise<Result> {
    await this.strategiesService.resumeAll(type);
    return Result.success();
  }


  @Post(':id/execute')
  async executeDirectly(@Param('id') id: number): Promise<Result> {
    const strategy = await this.executorsService.executeStrategyDirectly(+id);
    return ValueResult.value(strategy);
  }

  @Post(':id/test-execute')
  async textExecuteDirectly(@Param('id') id: number): Promise<ValueResult<Strategy>> {
    const options: StrategyExecutionOptions = {skipPlaceOrder: true};
    const strategy = await this.executorsService.executeStrategyDirectly(+id, options);
    return ValueResult.value(strategy);
  }

  @Post('executeAll')
  async executeAll(): Promise<Result> {
    await this.executorsService.executeAll({ignoreInterval: true, context: 'web'});
    return Result.success();
  }

  @Post('execute/type/:type')
  async executeForType(@Param('type') type: string): Promise<Result> {
    await this.executorsService.executeAll({type, ignoreInterval: true, context: 'web'});
    return Result.success();
  }

  @Get('count/bq')
  async countByBaseQuote(): Promise<ListResult<BaseQuoteStrategyCounts>> {
    const cs = await this.strategiesService.countByBaseQuote();
    return ListResult.list(cs);
  }
}
