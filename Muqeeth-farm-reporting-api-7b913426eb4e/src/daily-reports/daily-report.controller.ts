import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { DailyReportService } from './daily-report.service';
import { SubmitDailyReportDto } from './dto/submit-daily-report.dto';
import { DailyReportResponseDto } from './dto/daily-report-response.dto';

@Controller('api/daily-reports')
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  /**
   * Submit a complete daily report with all related data
   * POST /api/daily-reports/submit
   *
   * `reportDate` supports ISO-8601 date format (YYYY-MM-DD), stored as YYYYMMDD number, e.g. "2024-03-25".
   *
   * Request body:
   * {
   *   "reportDate": "2024-03-25",
   *   "submitterId": 1,
   *   "sales": [
   *     {
   *       "partyId": 1,
   *       "vehicleNumber": "ABC-123",
   *       "items": [
   *         {
   *           "shedId": 1,
   *           "standardEggs": 100,
   *           "smallEggs": 50
   *         }
   *       ]
   *     }
   *   ],
   *   "feedReceipts": [
   *     {
   *       "partyId": 2,
   *       "feedItemId": 1,
   *       "vehicleNumber": "XYZ-789",
   *       "quantityKg": 500.50
   *     }
   *   ],
   *   "shedDailyReports": [
   *     {
   *       "shedId": 1,
   *       "birdsMortality": 2,
   *       "closingBirds": 998,
   *       "damagedEggs": 5,
   *       "standardEggsClosing": 800,
   *       "smallEggsClosing": 150
   *     }
   *   ]
   * }
   */
  @Post('submit')
  @HttpCode(201)
  async submitDailyReport(@Body() submitDailyReportDto: SubmitDailyReportDto) {
    return this.dailyReportService.submitDailyReport(submitDailyReportDto);
  }

  @Put('update')
  @HttpCode(200)
  async updateDailyReport(@Body() submitDailyReportDto: SubmitDailyReportDto) {
    return this.dailyReportService.updateDailyReport(submitDailyReportDto);
  }

  /**
   * Get all daily reports
   * GET /daily-reports
   */
  @Get()
  async findAll() {
    return this.dailyReportService.findAll();
  }

  /**
   * Get a specific daily report with all its details
   * GET /daily-reports/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: number): Promise<DailyReportResponseDto> {
    return this.dailyReportService.getDailyReportWithDetails(id);
  }

  /**
   * Get a specific daily report by date with all its details
   * GET /daily-reports/by-date/:date
   *
   * Accepts date in ISO-8601 format (YYYY-MM-DD), stored as YYYYMMDD number, e.g. /by-date/2024-03-25
   */
  @Get('by-date/:date')
  async findByDate(
    @Param('date') date: string,
  ): Promise<DailyReportResponseDto> {
    return this.dailyReportService.getDailyReportByDate(date);
  }
}
