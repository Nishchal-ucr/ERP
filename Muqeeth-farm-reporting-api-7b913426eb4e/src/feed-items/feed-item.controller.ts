import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FeedItemService } from './feed-item.service';

@Controller('api/feed-items')
export class FeedItemController {
  constructor(private readonly feedItemService: FeedItemService) {}

  @Get()
  async findAll() {
    return this.feedItemService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.feedItemService.findOne(id);
  }
}
