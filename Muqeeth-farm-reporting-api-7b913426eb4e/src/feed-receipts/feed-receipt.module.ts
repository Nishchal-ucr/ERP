import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedReceipt } from './entities/feed-receipt.entity';
import { FeedReceiptService } from './feed-receipt.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeedReceipt])],
  providers: [FeedReceiptService],
  exports: [FeedReceiptService],
})
export class FeedReceiptModule {}
