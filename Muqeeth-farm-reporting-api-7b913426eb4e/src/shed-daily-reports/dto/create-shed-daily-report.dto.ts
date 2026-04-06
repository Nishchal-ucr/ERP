import { IsNumber, IsOptional } from 'class-validator';

export class CreateShedDailyReportDto {
  @IsNumber()
  shedId: number;

  @IsNumber()
  @IsOptional()
  birdsMortality?: number;

  @IsNumber()
  @IsOptional()
  closingBirds?: number;

  @IsNumber()
  @IsOptional()
  damagedEggs?: number;

  @IsNumber()
  @IsOptional()
  standardEggsClosing?: number;

  @IsNumber()
  @IsOptional()
  smallEggsClosing?: number;

  @IsNumber()
  @IsOptional()
  totalFeedReceipt?: number;
}
