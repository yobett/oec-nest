import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Like, Not, Repository } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import {
  CreateSpotOrderDto,
  OrderTimeLineQueryForm,
  SpotOrder,
  SpotOrderFilter,
  UpdateSpotOrderDto
} from '../../models/per/spot-order';
import { Pager, Sorter } from '../../models/query-params';
import { CountList } from '../../models/result';


@Injectable()
export class SpotOrderService {
  constructor(
    @InjectRepository(SpotOrder)
    protected readonly orderRepository: Repository<SpotOrder>,
  ) {
  }

  findOne(id: number): Promise<SpotOrder> {
    return this.orderRepository.findOne(id);
  }

  findByOrderId(ex: string, orderId: string): Promise<SpotOrder> {
    return this.orderRepository.findOne({ex, orderId});
  }

  findByClientOrderId(clientOrderId: string): Promise<SpotOrder> {
    return this.orderRepository.findOne({clientOrderId});
  }

  findByExPair(ex: string, pairSymbol: string): Promise<SpotOrder[]> {
    return this.orderRepository.find({ex, pairSymbol});
  }

  async latestOneOrder(where: any): Promise<SpotOrder> {
    const os = await this.orderRepository.find({
      where,
      order: {createTs: 'DESC'},
      take: 1
    });
    if (os && os.length > 0) {
      return os[0];
    }
    return null;
  }

  async latestOrderForEx(ex: string): Promise<SpotOrder> {
    return this.latestOneOrder({ex});
  }

  async latestOrderForExPair(ex: string, pairSymbol: string): Promise<SpotOrder> {
    return this.latestOneOrder({ex, pairSymbol});
  }

  async page(pager: Pager, filter?: SpotOrderFilter, sorter?: Sorter): Promise<CountList<SpotOrder>> {
    const where: FindConditions<SpotOrder> = {};
    if (filter) {
      const {ex, baseCcy, quoteCcy, pairSymbolLike, createTsTo} = filter;
      if (ex) {
        where.ex = ex;
      }
      if (baseCcy) {
        where.baseCcy = baseCcy;
      }
      if (quoteCcy) {
        where.quoteCcy = quoteCcy;
      }
      if (pairSymbolLike) {
        where.pairSymbol = Like(`%${pairSymbolLike}%`);
      }
      if (!isNaN(createTsTo)) {
        where.createTs = LessThan(+createTsTo);
      }
    }
    const order: any = (sorter && sorter.sort) ? {[sorter.sort]: sorter.sortDir} : {createTs: 'DESC'};
    const [list, count] = await this.orderRepository.findAndCount({
      where,
      order,
      skip: pager.skip,
      take: pager.pageSize
    });

    return {count, list};
  }


  async timeLineQuery(queryForm: OrderTimeLineQueryForm): Promise<SpotOrder[]> {
    const where: FindConditions<SpotOrder> = {
      status: Not('canceled')
    };
    const {ex, olderThan, limit} = queryForm;
    if (ex) {
      where.ex = ex;
    }
    if (olderThan) {
      where.createTs = LessThan(olderThan);
    }
    return await this.orderRepository.find({
      where,
      order: {createTs: 'DESC'},
      take: limit
    });
  }

  async findByCcy(ccy: string,
                  limit = 10): Promise<SpotOrder[]> {
    let sql = `select o.* from spot_order o`;
    sql += ` where o.baseCcy=? or o.quoteCcy=?`;
    sql += ` order by o.updateTs desc limit ${limit}`;
    return await this.orderRepository.query(sql, [ccy, ccy]);
  }

  async findByExCcy(ex: string,
                    ccy: string,
                    limit = 10): Promise<SpotOrder[]> {
    let sql = `select o.* from spot_order o`;
    sql += ` where o.ex=?`;
    sql += ` and (o.baseCcy=? or o.quoteCcy=?)`;
    sql += ` order by o.updateTs desc limit ${limit}`;
    return await this.orderRepository.query(sql, [ex, ccy, ccy]);
  }

  async create(dto: CreateSpotOrderDto): Promise<SpotOrder> {
    if (dto.updateTs === 0 || dto.updateTs === null) {
      dto.updateTs = dto.createTs;
    }
    return this.orderRepository.save(dto);
  }

  async update(id: number, dto: UpdateSpotOrderDto): Promise<void> {
    if (dto.updateTs === 0 || dto.updateTs === null) {
      delete dto.updateTs;
    }
    await this.orderRepository.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    await this.orderRepository.delete(id);
  }
}
