import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShedDailyReport } from './entities/shed-daily-report.entity';
import { ShedDailyReportService } from './shed-daily-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShedDailyReport])],
  providers: [ShedDailyReportService],
  exports: [ShedDailyReportService],
})
export class ShedDailyReportModule {}
