import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedItemService } from './feed-item.service';
import { FeedItemController } from './feed-item.controller';
import { FeedItem } from './entities/feed-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedItem])],
  controllers: [FeedItemController],
  providers: [FeedItemService],
  exports: [FeedItemService],
})
export class FeedItemModule {}
