import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, } from '@nestjs/common';
import { CreateLastTransDto, LastTransaction, UpdateLastTransDto } from '../../models/per/last-transaction';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, Result, ValueResult } from '../../models/result';
import { LastTransactionService } from '../../services/per/last-transaction.service';
import { ExPairsService } from '../../services/mar/pairs.service';
import { ExPair } from '../../models/mar/ex-pair';


declare type LTnP = LastTransaction & { pair: ExPair };

@Controller('per/last-trans')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class LastTransController {
  constructor(private pairsService: ExPairsService,
              private ltService: LastTransactionService) {
  }

  @Get()
  async findAll(): Promise<ListResult<LastTransaction>> {
    const lts: LastTransaction[] = await this.ltService.findAll();
    return ListResult.list(lts);
  }

  @Get('all/withPair')
  async findAllWithPair(): Promise<ListResult<LTnP>> {
    const lts = await this.ltService.findAll();

    const pairsMap = new Map<string, ExPair>();
    const pairs = await this.pairsService.findPairs(lts);
    for (const pair of pairs) {
      pairsMap.set(`${pair.baseCcy}-${pair.quoteCcy}`, pair);
      delete pair.baseCcy;
      delete pair.quoteCcy;
      delete pair.createdAt;
    }

    const ltnps = lts.map(lt => {
      const ltnp = lt as LTnP;
      ltnp.pair = pairsMap.get(`${lt.baseCcy}-${lt.quoteCcy}`);
      return ltnp;
    });

    return ListResult.list(ltnps);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<LastTransaction>> {
    const value: LastTransaction = await this.ltService.findOne(+id);
    return ValueResult.value(value);
  }

  @Get('bq/:baseCcy/:quoteCcy')
  async findByCcy(@Param('baseCcy') baseCcy: string,
                  @Param('quoteCcy') quoteCcy: string): Promise<ValueResult<LastTransaction>> {
    const value: LastTransaction = await this.ltService.findTransaction(baseCcy, quoteCcy);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: CreateLastTransDto): Promise<ValueResult<LastTransaction>> {
    dto.updateTs = Date.now();
    const value: LastTransaction = await this.ltService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLastTransDto): Promise<Result> {
    dto.updateTs = Date.now();
    await this.ltService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.ltService.remove(+id);
    return Result.success();
  }
}
