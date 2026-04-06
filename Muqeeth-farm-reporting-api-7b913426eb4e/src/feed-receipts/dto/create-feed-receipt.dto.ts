import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateFeedReceiptDto {
  @IsNumber()
  partyId: number;

  @IsNumber()
  feedItemId: number;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsNumber()
  quantityKg: number;
}
