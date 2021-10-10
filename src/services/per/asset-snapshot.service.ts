import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { LessThan, MoreThan, Raw, Repository } from 'typeorm';

import { Asset } from '../../models/per/asset';
import { AssetSnapshot, AssetSnapshotQueryForm } from '../../models/per/asset-snapshot';

@Injectable()
export class AssetSnapshotService {
  constructor(
    @InjectRepository(Asset)
    protected readonly assetsRepository: Repository<Asset>,
    @InjectRepository(AssetSnapshot)
    protected readonly snapshotsRepository: Repository<AssetSnapshot>,
  ) {
  }


  findOne(id: number): Promise<AssetSnapshot> {
    return this.snapshotsRepository.findOne(id);
  }

  find(queryForm: AssetSnapshotQueryForm): Promise<AssetSnapshot[]> {
    const where: any = {ccy: queryForm.ccy};
    if (queryForm.olderThan) {
      where.ts = LessThan(queryForm.olderThan);
    }
    if (queryForm.newerThan) {
      where.ts = MoreThan(queryForm.newerThan);
    }
    if (!isNaN(queryForm.hour)) {
      where.hour = +queryForm.hour;
    }
    if (queryForm.hourMod) {
      where.hour = Raw((alias) => `${alias} % ${queryForm.hourMod} = 0`);
    }
    return this.snapshotsRepository.find({
      where,
      order: {ts: 'DESC'},
      take: queryForm.limit
    });
  }

  findByTs(ts: number): Promise<AssetSnapshot[]> {
    return this.snapshotsRepository.find({
      where: {ts},
      order: {holdingValue: 'DESC'},
    });
  }

  async findLatest(): Promise<AssetSnapshot[]> {
    const all: AssetSnapshot[] = await this.find({ccy: AssetSnapshot.CcyAll, limit: 1});
    if (all.length === 0) {
      return [];
    }
    return this.findByTs(all[0].ts);
  }


  async findLatestAssetCodes(): Promise<string[]> {
    const sns = await this.snapshotsRepository
      .query(`select ccy from asset_snapshot where ts = (select ts from asset_snapshot order by ts desc limit 1)`
        + ` and ccy <> '${AssetSnapshot.CcyAll}' order by holdingValue desc`);
    return sns.map(a => a.ccy);
  }

  async findAssetCodes(ts: number): Promise<string[]> {
    if (isNaN(ts)) {
      return [];
    }
    const sns = await this.snapshotsRepository
      .query(`select ccy from asset_snapshot where ts = (select ts from asset_snapshot where ts < ? order by ts desc limit 1)`
        + ` and ccy <> '${AssetSnapshot.CcyAll}' order by holdingValue desc`, [ts]);
    return sns.map(a => a.ccy);
  }

  async create(dto: AssetSnapshot): Promise<AssetSnapshot> {
    return this.snapshotsRepository.save(dto);
  }

  async update(id: number, dto: AssetSnapshot): Promise<void> {
    await this.snapshotsRepository.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    await this.snapshotsRepository.delete(id);
  }
}
