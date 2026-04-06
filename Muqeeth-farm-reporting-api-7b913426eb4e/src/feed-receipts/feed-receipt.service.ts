import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedReceipt } from './entities/feed-receipt.entity';
import { CreateFeedReceiptDto } from './dto/create-feed-receipt.dto';

@Injectable()
export class FeedReceiptService {
  constructor(
    @InjectRepository(FeedReceipt)
    private readonly feedReceiptRepository: Repository<FeedReceipt>,
  ) {}

  /**
   * Create a feed receipt
   */
  async createFeedReceipt(
    dailyReportId: number,
    createFeedReceiptDto: CreateFeedReceiptDto,
  ): Promise<FeedReceipt> {
    const feedReceipt = this.feedReceiptRepository.create({
      dailyReportId,
      partyId: createFeedReceiptDto.partyId,
      feedItemId: createFeedReceiptDto.feedItemId,
      vehicleNumber: createFeedReceiptDto.vehicleNumber,
      quantityKg: createFeedReceiptDto.quantityKg,
    });

    return await this.feedReceiptRepository.save(feedReceipt);
  }

  /**
   * Create multiple feed receipts
   */
  async createMultipleFeedReceipts(
    dailyReportId: number,
    createFeedReceiptDtos: CreateFeedReceiptDto[],
  ): Promise<FeedReceipt[]> {
    const feedReceipts: FeedReceipt[] = [];

    for (const createFeedReceiptDto of createFeedReceiptDtos) {
      const feedReceipt = await this.createFeedReceipt(
        dailyReportId,
        createFeedReceiptDto,
      );
      feedReceipts.push(feedReceipt);
    }

    return feedReceipts;
  }

  findAll() {
    return this.feedReceiptRepository.find({
      relations: ['dailyReport', 'party', 'feedItem'],
    });
  }

  findOne(id: number) {
    return this.feedReceiptRepository.findOne({
      where: { id },
      relations: ['dailyReport', 'party', 'feedItem'],
    });
  }

  async deleteByDailyReport(dailyReportId: number) {
    return this.feedReceiptRepository.delete({ dailyReportId });
  }

  findByDailyReport(dailyReportId: number) {
    return this.feedReceiptRepository.find({
      where: { dailyReportId },
      relations: ['party', 'feedItem'],
    });
  }
}
