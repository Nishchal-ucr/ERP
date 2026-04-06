import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { Shed } from '../../sheds/entities/shed.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ type: 'int' })
  saleId: number;

  @ManyToOne(() => Shed)
  @JoinColumn({ name: 'shed_id' })
  shed: Shed;

  @Column({ type: 'int' })
  shedId: number;

  @Column({ type: 'int', default: 0 })
  standardEggs: number;

  @Column({ type: 'int', default: 0 })
  smallEggs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
