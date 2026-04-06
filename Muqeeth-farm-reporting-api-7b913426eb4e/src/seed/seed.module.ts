import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../user/entities/user.entity';
import { Party } from '../parties/entities/party.entity';
import { FeedItem } from '../feed-items/entities/feed-item.entity';
import { Shed } from '../sheds/entities/shed.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Party, FeedItem, Shed])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
