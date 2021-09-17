import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ExchsService } from '../../services/sys/exchs.service';
import { Exch, UpdateExchDto } from '../../models/sys/exch';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, Result, ValueResult } from '../../models/result';

@Controller('sys/exchs')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class ExchsController {
  constructor(private readonly exchsService: ExchsService) {
  }

  @Get()
  async findAll(): Promise<ListResult<Exch>> {
    const list = await this.exchsService.findAll();
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<Exch>> {
    const value = await this.exchsService.findOne(+id);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExchDto): Promise<Result> {
    await this.exchsService.update(+id, dto);
    return Result.success();
  }
}
