import { IsNumber, IsOptional } from 'class-validator';

export class CreateSaleItemDto {
  @IsNumber()
  shedId: number;

  @IsNumber()
  @IsOptional()
  standardEggs?: number = 0;

  @IsNumber()
  @IsOptional()
  smallEggs?: number = 0;
}
