import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { Ccy, CcyFilter, CreateCcyDto, UpdateCcyDto } from '../../models/mar/ccy';
import { Pager, QueryParams, Sorter } from '../../models/query-params';
import { CountList } from '../../models/result';
import { setWildcardCondition } from '../../common/utils';


@Injectable()
export class CcysService {

  constructor(
    @InjectRepository(Ccy) protected readonly ccysRepository: Repository<Ccy>,
  ) {
  }

  findOne(id: number): Promise<Ccy> {
    return this.ccysRepository.findOne(id);
  }

  findByCode(code: string): Promise<Ccy> {
    return this.ccysRepository.findOne({code});
  }

  findByCodes(codes: string[]): Promise<Ccy[]> {
    return this.ccysRepository.find({code: In(codes)});
  }

  async checkNewCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) {
      return [];
    }
    const ccys = await this.ccysRepository.find({
      where: {code: In(codes)},
      select: ['code']
    });
    const exists = ccys.map(c => c.code);
    return codes.filter(c => !exists.includes(c));
  }

  findAll(): Promise<Ccy[]> {
    return this.ccysRepository.find();
  }

  async page(pager: Pager, filter?: CcyFilter, sorter?: Sorter): Promise<CountList<Ccy>> {
    const where: FindConditions<Ccy> = {};
    if (filter) {
      const {code, name, concerned} = filter;
      setWildcardCondition(where, 'code', code);
      setWildcardCondition(where, 'name', name);
      if (typeof concerned !== 'undefined') {
        where.concerned = QueryParams.parseBoolean(concerned);
      }
    }
    const order = (sorter && sorter.sort) ? {[sorter.sort]: sorter.sortDir} : null;
    const [list, count] = await this.ccysRepository.findAndCount({
      where,
      order,
      skip: pager.skip,
      take: pager.pageSize
    });

    return {count, list};
  }

  findConcerned(): Promise<Ccy[]> {
    return this.ccysRepository.find({concerned: true});
  }

  async findConcernedCodes(): Promise<string[]> {
    const ccys = await this.ccysRepository.find({
      where: {concerned: true},
      select: ['code'],
      order: {no: 'ASC'}
    });
    return ccys.map(a => a.code);
  }

  async create(createCcyDto: CreateCcyDto): Promise<Ccy> {
    return this.ccysRepository.save(createCcyDto);
  }

  async saveMany(ccys: Ccy[]): Promise<Ccy[]> {
    return this.ccysRepository.save(ccys, {reload: false, chunk: 100});
  }

  async updateConcerned(id: number, concerned: boolean): Promise<void> {
    await this.ccysRepository.update(id, {concerned});
  }

  async updateConcernedByCode(code: string, concerned: boolean): Promise<void> {
    await this.ccysRepository.update({
      code
    }, {concerned});
  }

  async addConcernedByCodes(codes: string[]): Promise<void> {
    await this.ccysRepository.update({
      code: In(codes)
    }, {concerned: true});
  }

  async update(id: number, updateCcyDto: UpdateCcyDto): Promise<void> {
    await this.ccysRepository.update(id, updateCcyDto);
  }

  async remove(id: number): Promise<void> {
    await this.ccysRepository.delete(id);
  }
}
