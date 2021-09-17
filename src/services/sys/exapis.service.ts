import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { API, CreateExapiDto, Exapi, UpdateExapiDto } from '../../models/sys/exapi';


@Injectable()
export class ExapisService {
  constructor(
    @InjectRepository(Exapi)
    protected readonly exapisRepository: Repository<Exapi>,
  ) {
  }

  findOne(id: number): Promise<Exapi> {
    return this.exapisRepository.findOne(id);
  }

  findAll(): Promise<Exapi[]> {
    return this.exapisRepository.find();
  }

  async findExapis(): Promise<Map<string, API>> {
    const exapis: Exapi[] = await this.exapisRepository.find({enabled: true});
    return new Map<string, Exapi>(exapis.map(e => [e.ex, e]));
  }

  findExapi(ex: string): Promise<API> {
    return this.exapisRepository.findOne({enabled: true, ex});
  }

  async create(dto: CreateExapiDto): Promise<Exapi> {
    return this.exapisRepository.save(dto);
  }

  async update(id: number, dto: UpdateExapiDto): Promise<void> {
    dto.updatedAt = new Date()
    await this.exapisRepository.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    await this.exapisRepository.delete(id);
  }
}
