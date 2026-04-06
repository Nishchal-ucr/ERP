import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from '../sale-items/entities/sale-item.entity';
import { SaleService } from './sale.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem])],
  providers: [SaleService],
  exports: [SaleService],
})
export class SaleModule {}
