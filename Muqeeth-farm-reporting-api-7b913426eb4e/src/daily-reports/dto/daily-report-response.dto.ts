import { ApiProperty } from '@nestjs/swagger';

export class SaleItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  saleId: number;

  @ApiProperty({ example: 1 })
  shedId: number;

  @ApiProperty({ example: 100 })
  standardEggs: number;

  @ApiProperty({ example: 50 })
  smallEggs: number;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  updatedAt: Date;
}

export class SaleResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  dailyReportId: number;

  @ApiProperty({ example: 1 })
  partyId: number;

  @ApiProperty({ example: 'ABC-123', required: false })
  vehicleNumber?: string;

  @ApiProperty({ type: [SaleItemResponseDto] })
  items: SaleItemResponseDto[];

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  updatedAt: Date;
}

export class FeedReceiptResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  dailyReportId: number;

  @ApiProperty({ example: 2 })
  partyId: number;

  @ApiProperty({ example: 1 })
  feedItemId: number;

  @ApiProperty({ example: 'XYZ-789', required: false })
  vehicleNumber?: string;

  @ApiProperty({ example: 500.5 })
  quantityKg: number;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  updatedAt: Date;
}

export class ShedDailyReportResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  dailyReportId: number;

  @ApiProperty({ example: 1 })
  shedId: number;

  @ApiProperty({ example: 2, required: false })
  birdsMortality?: number;

  @ApiProperty({ example: 998, required: false })
  closingBirds?: number;

  @ApiProperty({ example: 5, required: false })
  damagedEggs?: number;

  @ApiProperty({ example: 800, required: false })
  standardEggsClosing?: number;

  @ApiProperty({ example: 150, required: false })
  smallEggsClosing?: number;

  @ApiProperty({ example: 1000.5, required: false })
  totalFeedReceipt?: number;

  @ApiProperty({ example: 950.3, required: false })
  closingFeed?: number;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  updatedAt: Date;
}

export class DailyReportResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 20240325 })
  reportDate: number;

  @ApiProperty({ example: 1 })
  createdByUserId: number;

  @ApiProperty({ example: 'SUBMITTED' })
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z', required: false })
  submittedAt?: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [SaleResponseDto], required: false })
  sales?: SaleResponseDto[];

  @ApiProperty({ type: [FeedReceiptResponseDto], required: false })
  feedReceipts?: FeedReceiptResponseDto[];

  @ApiProperty({ type: [ShedDailyReportResponseDto], required: false })
  shedDailyReports?: ShedDailyReportResponseDto[];
}
