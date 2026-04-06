import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shed } from './entities/shed.entity';

@Injectable()
export class ShedService {
  constructor(
    @InjectRepository(Shed)
    private shedRepository: Repository<Shed>,
  ) {}

  async findAll(): Promise<Shed[]> {
    return this.shedRepository.find();
  }

  async findOne(id: number): Promise<Shed> {
    return this.shedRepository.findOne({ where: { id } });
  }
}
