import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyReport } from './entities/daily-report.entity';
import { SubmitDailyReportDto } from './dto/submit-daily-report.dto';
import {
  DailyReportResponseDto,
  SaleResponseDto,
  FeedReceiptResponseDto,
  ShedDailyReportResponseDto,
} from './dto/daily-report-response.dto';
import { SaleService } from '../sales/sale.service';
import { FeedReceiptService } from '../feed-receipts/feed-receipt.service';
import { ShedDailyReportService } from '../shed-daily-reports/shed-daily-report.service';

@Injectable()
export class DailyReportService {
  constructor(
    @InjectRepository(DailyReport)
    private readonly dailyReportRepository: Repository<DailyReport>,
    private readonly saleService: SaleService,
    private readonly feedReceiptService: FeedReceiptService,
    private readonly shedDailyReportService: ShedDailyReportService,
  ) {}

  /**
   * Submit a complete daily report with all related data
   *
   * Saves in sequence:
   * 1. DailyReport
   * 2. Sales (with SaleItems)
   * 3. FeedReceipts
   * 4. ShedDailyReports
   */
  async submitDailyReport(
    submitDailyReportDto: SubmitDailyReportDto,
  ): Promise<DailyReport> {
    // Parse the report date to YYYYMMDD format
    const reportDate = this._parseDateToYYYYMMDD(
      submitDailyReportDto.reportDate,
    );

    // Check if a report already exists for this date
    const existingReport = await this.dailyReportRepository.findOne({
      where: { reportDate },
    });

    if (existingReport) {
      throw new BadRequestException(
        'Cannot submit: A report for this date has already been submitted.',
      );
    }

    const dailyReport = this.dailyReportRepository.create({
      reportDate,
      createdByUserId: submitDailyReportDto.submitterId,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    const savedDailyReport = await this.dailyReportRepository.save(dailyReport);

    await this._saveRelatedData(savedDailyReport.id, submitDailyReportDto);

    return savedDailyReport;
  }

  async updateDailyReport(
    submitDailyReportDto: SubmitDailyReportDto,
  ): Promise<DailyReport> {
    const reportDate = this._parseDateToYYYYMMDD(
      submitDailyReportDto.reportDate,
    );

    let dailyReport = await this.dailyReportRepository.findOne({
      where: { reportDate },
    });

    if (!dailyReport) {
      throw new NotFoundException(
        `Cannot update: no report exists for ${submitDailyReportDto.reportDate}.`,
      );
    }

    // if there is a newer submitted report, this date is locked
    const maxDateResult = await this.dailyReportRepository
      .createQueryBuilder('dailyReport')
      .select('MAX(dailyReport.reportDate)', 'max')
      .getRawOne<{ max: number } | null>();

    console.log('maxDateResult', maxDateResult);

    const maxReportDate = maxDateResult?.max || null;

    if (maxReportDate && maxReportDate > reportDate) {
      throw new BadRequestException(
        'Cannot update: A report for this date has already been submitted and locked.',
      );
    }

    if (dailyReport) {
      dailyReport.status = 'SUBMITTED';
      dailyReport.submittedAt = new Date();
      dailyReport.createdByUserId = submitDailyReportDto.submitterId;

      dailyReport = await this.dailyReportRepository.save(dailyReport);
    } else {
      dailyReport = this.dailyReportRepository.create({
        reportDate,
        createdByUserId: submitDailyReportDto.submitterId,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      });

      dailyReport = await this.dailyReportRepository.save(dailyReport);
    }

    // Clear existing child entities before re-creating
    await this.saleService.deleteByDailyReport(dailyReport.id);
    await this.feedReceiptService.deleteByDailyReport(dailyReport.id);
    await this.shedDailyReportService.deleteByDailyReport(dailyReport.id);

    await this._saveRelatedData(dailyReport.id, submitDailyReportDto);

    return dailyReport;
  }

  private async _saveRelatedData(
    dailyReportId: number,
    submitDailyReportDto: SubmitDailyReportDto,
  ) {
    // Save Sales with their items (sequence: Sales first, then SaleItems)
    if (submitDailyReportDto.sales && submitDailyReportDto.sales.length > 0) {
      await this.saleService.createMultipleSalesWithItems(
        dailyReportId,
        submitDailyReportDto.sales,
      );
    }

    // Save FeedReceipts
    if (
      submitDailyReportDto.feedReceipts &&
      submitDailyReportDto.feedReceipts.length > 0
    ) {
      await this.feedReceiptService.createMultipleFeedReceipts(
        dailyReportId,
        submitDailyReportDto.feedReceipts,
      );
    }

    // Save ShedDailyReports
    if (
      submitDailyReportDto.shedDailyReports &&
      submitDailyReportDto.shedDailyReports.length > 0
    ) {
      await this.shedDailyReportService.createMultipleShedDailyReports(
        dailyReportId,
        submitDailyReportDto.shedDailyReports,
      );
    }
  }

  /**
   * Get a daily report with all its related data
   */
  async getDailyReportWithDetails(id: number): Promise<DailyReportResponseDto> {
    const dailyReport = await this.dailyReportRepository.findOne({
      where: { id },
      relations: ['createdByUser'],
    });

    if (!dailyReport) {
      throw new NotFoundException(`Daily report with ID ${id} not found.`);
    }

    return await this._buildDailyReportWithDetails(dailyReport);
  }

  async getDailyReportByDate(
    dateString: string,
  ): Promise<DailyReportResponseDto> {
    const reportDate = this._parseDateToYYYYMMDD(dateString);

    const dailyReport = await this.dailyReportRepository.findOne({
      where: { reportDate },
      relations: ['createdByUser'],
    });

    if (!dailyReport) {
      throw new NotFoundException(
        `Daily report for date ${dateString} not found.`,
      );
    }

    return await this._buildDailyReportWithDetails(dailyReport);
  }

  private async _buildDailyReportWithDetails(
    dailyReport: DailyReport,
  ): Promise<DailyReportResponseDto> {
    const id = dailyReport.id;

    const [sales, feedReceipts, shedDailyReports] = await Promise.all([
      this.saleService.findByDailyReport(id),
      this.feedReceiptService.findByDailyReport(id),
      this.shedDailyReportService.findByDailyReport(id),
    ]);

    return {
      ...dailyReport,
      sales: sales as SaleResponseDto[],
      feedReceipts: feedReceipts as FeedReceiptResponseDto[],
      shedDailyReports: shedDailyReports as ShedDailyReportResponseDto[],
    };
  }

  findAll() {
    return this.dailyReportRepository.find({
      relations: ['createdByUser'],
      order: { reportDate: 'DESC' },
    });
  }

  findOne(id: number) {
    return this.dailyReportRepository.findOne({
      where: { id },
      relations: ['createdByUser'],
    });
  }

  findByDate(date: number) {
    return this.dailyReportRepository.findOne({
      where: { reportDate: date },
      relations: ['createdByUser'],
    });
  }

  private _parseDateToYYYYMMDD(dateString: string): number {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateString}`);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  }
}
