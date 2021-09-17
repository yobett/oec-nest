import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, Result, ValueResult } from '../../models/result';
import { ExapisService } from '../../services/sys/exapis.service';
import { CreateExapiDto, Exapi, UpdateExapiDto } from '../../models/sys/exapi';

@Controller('sys/exapis')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class ExapisController {
  constructor(private exapisService: ExapisService) {
  }

  @Get()
  async findAll(): Promise<ListResult<Exapi>> {
    const list: Exapi[] = await this.exapisService.findAll();
    return ListResult.list(list);
  }


  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<Exapi>> {
    const value: Exapi = await this.exapisService.findOne(+id);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: CreateExapiDto): Promise<ValueResult<Exapi>> {
    const value: Exapi = await this.exapisService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExapiDto): Promise<Result> {
    await this.exapisService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.exapisService.remove(+id);
    return Result.success();
  }
}
