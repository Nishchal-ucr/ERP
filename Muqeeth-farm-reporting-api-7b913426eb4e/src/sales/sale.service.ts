import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from '../sale-items/entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
  ) {}

  /**
   * Create a sale with its items
   * Saves in sequence: first the sale, then the sale items
   */
  async createSaleWithItems(
    dailyReportId: number,
    createSaleDto: CreateSaleDto,
  ): Promise<Sale> {
    // Create the sale
    const sale = this.saleRepository.create({
      dailyReportId,
      partyId: createSaleDto.partyId,
      vehicleNumber: createSaleDto.vehicleNumber,
    });

    const savedSale = await this.saleRepository.save(sale);

    // Create sale items for this sale
    if (createSaleDto.items && createSaleDto.items.length > 0) {
      const saleItems = createSaleDto.items.map((item) =>
        this.saleItemRepository.create({
          saleId: savedSale.id,
          shedId: item.shedId,
          standardEggs: item.standardEggs || 0,
          smallEggs: item.smallEggs || 0,
        }),
      );

      await this.saleItemRepository.save(saleItems);
    }

    return savedSale;
  }

  /**
   * Create multiple sales with their items
   */
  async createMultipleSalesWithItems(
    dailyReportId: number,
    createSaleDtos: CreateSaleDto[],
  ): Promise<Sale[]> {
    const sales: Sale[] = [];

    for (const createSaleDto of createSaleDtos) {
      const sale = await this.createSaleWithItems(dailyReportId, createSaleDto);
      sales.push(sale);
    }

    return sales;
  }

  async deleteByDailyReport(dailyReportId: number) {
    return this.saleRepository.delete({ dailyReportId });
  }

  findAll() {
    return this.saleRepository.find({ relations: ['dailyReport', 'party'] });
  }

  findOne(id: number) {
    return this.saleRepository.findOne({
      where: { id },
      relations: ['dailyReport', 'party'],
    });
  }

  async findByDailyReport(dailyReportId: number) {
    const sales = await this.saleRepository.find({
      where: { dailyReportId },
      relations: ['party'],
    });

    if (!sales || sales.length === 0) {
      return [];
    }

    const saleIds = sales.map((sale) => sale.id);
    const saleItems = await this.saleItemRepository.find({
      where: { saleId: In(saleIds) },
      relations: ['shed'],
    });

    return sales.map((sale) => ({
      ...sale,
      items: saleItems
        .filter((item) => item.saleId === sale.id)
        .map(
          (item) =>
            ({
              id: item.id,
              shedId: item.shedId,
              saleId: item.saleId,
              standardEggs: item.standardEggs,
              smallEggs: item.smallEggs,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              shed: item.shed,
            }) as SaleItem,
        ),
    }));
  }
}
