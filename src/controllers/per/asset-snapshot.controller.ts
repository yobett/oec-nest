import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AssetSnapshotService } from '../../services/per/asset-snapshot.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetEvaluatorService } from '../../services/per/asset-evaluator.service';
import { ListResult } from '../../models/result';
import { AssetSnapshot, AssetSnapshotQueryForm } from '../../models/per/asset-snapshot';
import { AssetService } from '../../services/per/asset.service';

@Controller('per/asset-snapshots')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class AssetSnapshotController {
  constructor(private assetService: AssetService,
              private snapshotService: AssetSnapshotService,
              private assetEvaluatorService: AssetEvaluatorService) {
  }


  @Get('codes')
  async assetCodes(): Promise<ListResult<string>> {
    let ccys = await this.snapshotService.findLatestAssetCodes();
    if (ccys.length === 0) {
      ccys = await this.assetService.findCodes();
    }
    return ListResult.list(ccys);
  }

  @Post('build')
  async buildSnapshots(): Promise<ListResult<AssetSnapshot>> {
    const snapshots: AssetSnapshot[] = await this.assetEvaluatorService.buildSnapshots(true, false);
    return ListResult.list(snapshots);
  }


  @Get('ccy/:ccy')
  async list(
    @Param('ccy') ccy: string,
    @Query('limit') limit: number,
    @Query('hourMod') hourMod: number,
    @Query('olderThan') olderThan: number): Promise<ListResult<AssetSnapshot>> {
    const queryForm: AssetSnapshotQueryForm = {ccy, limit, hourMod, olderThan};
    const snapshots = await this.snapshotService.find(queryForm);
    return ListResult.list(snapshots);
  }

}
