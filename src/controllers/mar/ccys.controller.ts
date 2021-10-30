import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, } from '@nestjs/common';
import { CcysService } from '../../services/mar/ccys.service';
import { Ccy, CreateCcyDto, UpdateCcyDto } from '../../models/mar/ccy';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CountList, CountListResult, ListResult, Result, ValueResult } from '../../models/result';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { QueryParams } from '../../models/query-params';
import { CmcApiService } from '../../services/ex-api/cmc/cmc-api.service';
import { ExapisService } from '../../services/sys/exapis.service';
import { API, Exapi } from '../../models/sys/exapi';

@Controller('mar/ccys')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class CcysController {
  constructor(private ccysService: CcysService,
              private cmcApiService: CmcApiService,
              private exapisService: ExapisService) {
  }

  @Get()
  async findAll(): Promise<ListResult<Ccy>> {
    const list: Ccy[] = await this.ccysService.findAll();
    return ListResult.list(list);
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<Ccy>> {
    const {pager, filter, sorter} = query;
    const cl: CountList<Ccy> = await this.ccysService.page(pager, filter, sorter);
    return CountListResult.cl(cl);
  }

  @Get('concerned')
  async findConcerned(): Promise<ListResult<Ccy>> {
    const list: Ccy[] = await this.ccysService.findConcerned();
    return ListResult.list(list);
  }

  @Get('concerned/codes')
  async findConcernedCodes(): Promise<ListResult<string>> {
    const list: string[] = await this.ccysService.findConcernedCodes();
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<Ccy>> {
    const value: Ccy = await this.ccysService.findOne(+id);
    return ValueResult.value(value);
  }

  @Get('code/:code')
  async getByCode(@Param('code') code: string): Promise<ValueResult<Ccy>> {
    const value: Ccy = await this.ccysService.findByCode(code);
    return ValueResult.value(value);
  }

  @Get(':symbol/meta')
  async meta(@Param('symbol') symbol: string): Promise<ValueResult<any>> {
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const metaMap = await this.cmcApiService.metadata(api, [symbol]);
    const meta = metaMap[symbol];

    return ValueResult.value(meta);
  }

  @Post()
  async create(@Body() dto: CreateCcyDto): Promise<ValueResult<Ccy>> {
    const value: Ccy = await this.ccysService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCcyDto): Promise<Result> {
    await this.ccysService.update(+id, dto);
    return Result.success();
  }

  @Put(':id/addConcern')
  async addConcern(@Param('id') id: string): Promise<Result> {
    await this.ccysService.updateConcerned(+id, true);
    return Result.success();
  }

  @Put(':id/cancelConcern')
  async cancelConcern(@Param('id') id: string): Promise<Result> {
    await this.ccysService.updateConcerned(+id, false);
    return Result.success();
  }

  @Put('code/:code/addConcern')
  async addConcernByCode(@Param('code') code: string): Promise<Result> {
    await this.ccysService.updateConcernedByCode(code, true);
    return Result.success();
  }

  @Put('code/:code/cancelConcern')
  async cancelConcernByCode(@Param('code') code: string): Promise<Result> {
    await this.ccysService.updateConcernedByCode(code, false);
    return Result.success();
  }

  @Post('addConcern')
  async addConcernByCodes(@Body() codes: string[]): Promise<Result> {
    await this.ccysService.addConcernedByCodes(codes);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.ccysService.remove(+id);
    return Result.success();
  }
}
