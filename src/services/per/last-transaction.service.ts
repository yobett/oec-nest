import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLastTransDto, LastTransaction, UpdateLastTransDto } from '../../models/per/last-transaction';
import { SpotOrder } from '../../models/per/spot-order';


@Injectable()
export class LastTransactionService {
  constructor(
    @InjectRepository(LastTransaction)
    protected readonly ltRepository: Repository<LastTransaction>,
  ) {
  }

  findOne(id: number): Promise<LastTransaction> {
    return this.ltRepository.findOne(id);
  }

  findTransaction(baseCcy: string, quoteCcy: string): Promise<LastTransaction> {
    return this.ltRepository.findOne({baseCcy, quoteCcy});
  }

  findAll(): Promise<LastTransaction[]> {
    return this.ltRepository.find();
  }

  async create(dto: CreateLastTransDto): Promise<LastTransaction> {
    return this.ltRepository.save(dto);
  }

  async update(id: number, dto: UpdateLastTransDto): Promise<void> {
    await this.ltRepository.update(id, dto);
  }

  async syncFromOrder(order: SpotOrder): Promise<void> {

    if (order.status) {
      const status = order.status.toLowerCase();
      if (status === 'canceled' || status === 'submitted') {
        return;
      }
    }

    const udto: UpdateLastTransDto = {
      oid: order.id,
      ex: order.ex,
      side: order.side,
      avgPrice: order.avgPrice,
      execQty: order.execQty,
      quoteAmount: order.quoteAmount,
      updateTs: order.updateTs
    };

    const lastTrans = await this.findTransaction(order.baseCcy, order.quoteCcy);
    if (lastTrans) {
      await this.update(lastTrans.id, udto);
    } else {
      const cdto: CreateLastTransDto = {
        baseCcy: order.baseCcy,
        quoteCcy: order.quoteCcy,
        ...udto
      };
      await this.create(cdto);
    }
  }

  async remove(id: number): Promise<void> {
    await this.ltRepository.delete(id);
  }
}
