import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Party } from './entities/party.entity';

@Injectable()
export class PartyService {
  constructor(
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
  ) {}

  async findAll(): Promise<Party[]> {
    return this.partyRepository.find();
  }

  async findOne(id: number): Promise<Party> {
    return this.partyRepository.findOne({ where: { id } });
  }
}
