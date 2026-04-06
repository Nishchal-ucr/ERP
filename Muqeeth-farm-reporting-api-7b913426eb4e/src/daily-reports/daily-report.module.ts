import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyReport } from './entities/daily-report.entity';
import { DailyReportService } from './daily-report.service';
import { DailyReportController } from './daily-report.controller';
import { SaleModule } from '../sales/sale.module';
import { FeedReceiptModule } from '../feed-receipts/feed-receipt.module';
import { ShedDailyReportModule } from '../shed-daily-reports/shed-daily-report.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyReport]),
    SaleModule,
    FeedReceiptModule,
    ShedDailyReportModule,
  ],
  controllers: [DailyReportController],
  providers: [DailyReportService],
  exports: [DailyReportService],
})
export class DailyReportModule {}
