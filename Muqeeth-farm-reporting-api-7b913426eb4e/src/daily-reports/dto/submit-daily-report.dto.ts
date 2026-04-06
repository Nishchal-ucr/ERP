import {
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleDto } from '../../sales/dto/create-sale.dto';
import { CreateFeedReceiptDto } from '../../feed-receipts/dto/create-feed-receipt.dto';
import { CreateShedDailyReportDto } from '../../shed-daily-reports/dto/create-shed-daily-report.dto';

export class SubmitDailyReportDto {
  @IsDateString()
  reportDate: string; // ISO 8601 format (YYYY-MM-DD)

  @IsNumber()
  submitterId: number; // User ID of the person submitting

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleDto)
  @IsOptional()
  sales?: CreateSaleDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedReceiptDto)
  @IsOptional()
  feedReceipts?: CreateFeedReceiptDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShedDailyReportDto)
  @IsOptional()
  shedDailyReports?: CreateShedDailyReportDto[];
}
