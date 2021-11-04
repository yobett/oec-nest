import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { groupBy, toPairs } from 'lodash';
import { CreateExPairDto, ExchangePair, ExPair, ExPairFilter, PairBQ, UpdateExPairDto } from '../../models/mar/ex-pair';
import { Pager, QueryParams, Sorter } from '../../models/query-params';
import { CountList } from '../../models/result';
import { setWildcardCondition } from '../../common/utils';


@Injectable()
export class ExPairsService {
  constructor(@InjectRepository(ExPair)
              protected readonly pairsRepository: Repository<ExPair>
  ) {
  }

  findOne(id: number): Promise<ExPair> {
    return this.pairsRepository.findOne(id);
  }

  findPair(baseCcy: string, quoteCcy: string): Promise<ExPair> {
    return this.pairsRepository.findOne({baseCcy, quoteCcy});
  }

  findPairs(baseQuotes: PairBQ[]): Promise<ExPair[]> {
    const bqGroups = groupBy(baseQuotes, 'quoteCcy');
    const conditions: FindConditions<ExPair>[] = toPairs(bqGroups)
      .map(([quoteCcy, bqs]) => {
        return {
          baseCcy: (bqs.length === 1) ? bqs[0].baseCcy : In(bqs.map(bq => bq.baseCcy)),
          quoteCcy
        }
      });
    return this.pairsRepository.find({where: conditions});
  }

  findBySymbol(ex: string, symbol: string): Promise<ExPair> {
    return this.pairsRepository.findOne({[ex + 'Symbol']: symbol});
  }

  findAll(): Promise<ExPair[]> {
    return this.pairsRepository.find();
  }

  findByEx(ex: string): Promise<ExPair[]> {
    return this.pairsRepository.find({
      [ex + 'Symbol']: Not(IsNull())
    });
  }

  findConcerned(): Promise<ExPair[]> {
    return this.pairsRepository.find({concerned: true});
  }

  findByExConcerned(ex: string): Promise<ExPair[]> {
    return this.pairsRepository.find({
      [ex + 'Symbol']: Not(IsNull()),
      concerned: true
    });
  }

  findByConcernedSymbols(ex: string, symbols: string[]): Promise<ExPair[]> {
    const symbolField = (ex + 'Symbol') as keyof ExPair;
    return this.pairsRepository.find({
      where: {
        [symbolField]: In(symbols),
        concerned: true
      },
      select: [symbolField]
    });
  }

  findByExBaseConcerned(ex: string, baseCodes: string[]): Promise<ExPair[]> {
    return this.pairsRepository.find({
      [ex + 'Symbol']: Not(IsNull()),
      baseCcy: In(baseCodes),
      concerned: true
    });
  }

  async page(pager: Pager, filter?: ExPairFilter, sorter?: Sorter): Promise<CountList<ExPair>> {
    const where: FindConditions<ExPair> = {};
    if (filter) {
      const {ex, baseCcy, quoteCcy, concerned} = filter;
      if (ex) {
        where[ex + 'Symbol'] = Not(IsNull());
      }
      setWildcardCondition(where, 'baseCcy', baseCcy);
      setWildcardCondition(where, 'quoteCcy', quoteCcy);
      if (typeof concerned !== 'undefined') {
        where.concerned = QueryParams.parseBoolean(concerned);
      }
    }
    const order = (sorter && sorter.sort) ? {[sorter.sort]: sorter.sortDir} : null;
    const [list, count] = await this.pairsRepository.findAndCount({
      where,
      order,
      skip: pager.skip,
      take: pager.pageSize
    });

    return {count, list};
  }

  async findExchangePairsByBase(ex: string,
                                baseCcy: string,
                                limit = 10): Promise<ExchangePair[]> {
    let sql = `select quoteCcy, ${ex}Symbol symbol from ex_pair p`;
    sql += ` join ccy on ccy.code=p.quoteCcy`;
    sql += ` where p.baseCcy=? and ${ex}Symbol is not null`;
    sql += ` order by ccy.no limit ${limit}`;
    const ps: any[] = await this.pairsRepository.query(sql, [baseCcy]);
    return ps.map(p => ({
      ex,
      baseCcy,
      quoteCcy: p.quoteCcy,
      symbol: p.symbol
    }));
  }

  async findExchangePairsByQuote(ex: string,
                                 quoteCcy: string,
                                 limit = 10): Promise<ExchangePair[]> {
    let sql = `select baseCcy, ${ex}Symbol symbol from ex_pair p`;
    sql += ` join ccy on ccy.code=p.baseCcy`;
    sql += ` where p.quoteCcy=? and ${ex}Symbol is not null`;
    sql += ` order by ccy.concerned desc, ccy.no limit ${limit}`;
    const ps: any[] = await this.pairsRepository.query(sql, [quoteCcy]);
    return ps.map(p => ({
      ex,
      baseCcy: p.baseCcy,
      quoteCcy,
      symbol: p.symbol
    }));
  }


  async create(dto: CreateExPairDto): Promise<ExPair> {
    return this.pairsRepository.save(dto);
  }


  async updateConcerned(id: number, concerned: boolean): Promise<void> {
    await this.pairsRepository.update(id, {concerned});
  }

  async addConcernedWithQuote(baseCodes: string[], quote: string): Promise<void> {
    await this.pairsRepository.update({
      baseCcy: In(baseCodes),
      quoteCcy: quote
    }, {concerned: true});
  }

  async update(id: number, updateExPairDto: UpdateExPairDto): Promise<void> {
    await this.pairsRepository.update(id, updateExPairDto);
  }

  async remove(id: number): Promise<void> {
    await this.pairsRepository.delete(id);
  }
}
