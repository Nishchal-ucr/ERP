import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedItem } from './entities/feed-item.entity';

@Injectable()
export class FeedItemService {
  constructor(
    @InjectRepository(FeedItem)
    private feedItemRepository: Repository<FeedItem>,
  ) {}

  async findAll(): Promise<FeedItem[]> {
    return this.feedItemRepository.find();
  }

  async findOne(id: number): Promise<FeedItem> {
    return this.feedItemRepository.findOne({ where: { id } });
  }
}
