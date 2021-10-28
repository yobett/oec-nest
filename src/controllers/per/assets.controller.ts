import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, } from '@nestjs/common';

import { Asset, CreateAssetDto, UpdateAssetDto } from '../../models/per/asset';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, Result, ValueResult } from '../../models/result';
import { AssetService } from '../../services/per/asset.service';
import { AssetEvaluatorService } from '../../services/per/asset-evaluator.service';

@Controller('per/assets')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class AssetsController {
  constructor(private assetService: AssetService,
              private assetEvaluatorService: AssetEvaluatorService) {
  }

  @Get('codes')
  async assetCodes(): Promise<ListResult<string>> {
    const ccys = await this.assetService.findCodes();
    return ListResult.list(ccys);
  }

  @Get()
  async findAll(@Query('convert') convert: string,
                @Query('filterValue') filterValue?: number): Promise<ListResult<Asset>> {

    let assets: Asset[] = await this.assetService.findAll();
    try {
      await this.assetEvaluatorService.evaluate1(assets, convert);
      if (filterValue) {
        const threshold = +filterValue;
        assets = assets.filter(a => a.holdingValue > threshold);
      }
    } catch (e) {
      console.error(e);
    }

    return ListResult.list(assets);
  }

  @Get('ex/:ex')
  async findByEx(@Param('ex') ex: string,
                 @Query('convert') convert: string): Promise<ListResult<Asset>> {

    const assets: Asset[] = await this.assetService.findByEx(ex);
    try {
      await this.assetEvaluatorService.evaluate1(assets, convert);
    } catch (e) {
      console.error(e);
    }

    return ListResult.list(assets);
  }

  @Get('ebq/:ex/:baseCcy/:quoteCcy')
  async findByCcys(@Param('ex') ex: string,
                   @Param('baseCcy') baseCcy: string,
                   @Param('quoteCcy') quoteCcy: string): Promise<ListResult<Asset>> {
    const assets = await this.assetService.findAssets(ex, baseCcy, quoteCcy);
    return ListResult.list(assets);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<Asset>> {
    const value: Asset = await this.assetService.findOne(+id);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: CreateAssetDto): Promise<ValueResult<Asset>> {
    const value: Asset = await this.assetService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto): Promise<Result> {
    await this.assetService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.assetService.remove(+id);
    return Result.success();
  }
}
