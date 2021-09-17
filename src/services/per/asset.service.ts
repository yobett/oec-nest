import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Asset, CreateAssetDto, UpdateAssetDto } from '../../models/per/asset';
import { Config } from '../../common/config';


@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    protected readonly assetsRepository: Repository<Asset>,
  ) {
  }

  findOne(id: number): Promise<Asset> {
    return this.assetsRepository.findOne(id);
  }

  findAsset(ex: string, ccy: string): Promise<Asset> {
    return this.assetsRepository.findOne({ex, ccy});
  }

  findAssets(ex: string, ...ccys: string[]): Promise<Asset[]> {
    return this.assetsRepository.find({
      ex,
      ccy: In(ccys)
    });
  }

  findByEx(ex: string): Promise<Asset[]> {
    return this.assetsRepository.find({ex});
  }

  async findCodes(): Promise<string[]> {
    const threshold = Config.EX_DATA_SYNC.UPDATE_ASSET_THRESHOLD;
    const assets = await this.assetsRepository.query(`select distinct ccy from asset where holding > ${threshold}`);
    return assets.map(a => a.ccy);
  }

  findAll(): Promise<Asset[]> {
    return this.assetsRepository.find();
  }

  async create(dto: CreateAssetDto): Promise<Asset> {
    return this.assetsRepository.save(dto);
  }

  async update(id: number, dto: UpdateAssetDto): Promise<void> {
    await this.assetsRepository.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    await this.assetsRepository.delete(id);
  }
}
