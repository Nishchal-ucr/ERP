import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShedDailyReport } from './entities/shed-daily-report.entity';
import { CreateShedDailyReportDto } from './dto/create-shed-daily-report.dto';

@Injectable()
export class ShedDailyReportService {
  constructor(
    @InjectRepository(ShedDailyReport)
    private readonly shedDailyReportRepository: Repository<ShedDailyReport>,
  ) {}

  /**
   * Create a shed daily report
   */
  async createShedDailyReport(
    dailyReportId: number,
    createShedDailyReportDto: CreateShedDailyReportDto,
  ): Promise<ShedDailyReport> {
    const shedDailyReport = this.shedDailyReportRepository.create({
      dailyReportId,
      shedId: createShedDailyReportDto.shedId,
      birdsMortality: createShedDailyReportDto.birdsMortality,
      closingBirds: createShedDailyReportDto.closingBirds,
      damagedEggs: createShedDailyReportDto.damagedEggs,
      standardEggsClosing: createShedDailyReportDto.standardEggsClosing,
      smallEggsClosing: createShedDailyReportDto.smallEggsClosing,
      totalFeedReceipt: createShedDailyReportDto.totalFeedReceipt,
    });

    return await this.shedDailyReportRepository.save(shedDailyReport);
  }

  /**
   * Create multiple shed daily reports
   */
  async createMultipleShedDailyReports(
    dailyReportId: number,
    createShedDailyReportDtos: CreateShedDailyReportDto[],
  ): Promise<ShedDailyReport[]> {
    const shedDailyReports: ShedDailyReport[] = [];

    for (const createShedDailyReportDto of createShedDailyReportDtos) {
      const shedDailyReport = await this.createShedDailyReport(
        dailyReportId,
        createShedDailyReportDto,
      );
      shedDailyReports.push(shedDailyReport);
    }

    return shedDailyReports;
  }

  findAll() {
    return this.shedDailyReportRepository.find({
      relations: ['dailyReport', 'shed'],
    });
  }

  findOne(id: number) {
    return this.shedDailyReportRepository.findOne({
      where: { id },
      relations: ['dailyReport', 'shed'],
    });
  }

  async deleteByDailyReport(dailyReportId: number) {
    return this.shedDailyReportRepository.delete({ dailyReportId });
  }

  findByDailyReport(dailyReportId: number) {
    return this.shedDailyReportRepository.find({
      where: { dailyReportId },
      relations: ['shed'],
    });
  }
}
