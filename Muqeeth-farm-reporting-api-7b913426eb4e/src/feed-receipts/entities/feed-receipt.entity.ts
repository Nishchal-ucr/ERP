import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DailyReport } from '../../daily-reports/entities/daily-report.entity';
import { Party } from '../../parties/entities/party.entity';
import { FeedItem } from '../../feed-items/entities/feed-item.entity';

@Entity('feed_receipts')
export class FeedReceipt {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => DailyReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'daily_report_id' })
  dailyReport: DailyReport;

  @Column({ type: 'int' })
  dailyReportId: number;

  @ManyToOne(() => Party)
  @JoinColumn({ name: 'party_id' })
  party: Party;

  @Column({ type: 'int' })
  partyId: number;

  @ManyToOne(() => FeedItem)
  @JoinColumn({ name: 'feed_item_id' })
  feedItem: FeedItem;

  @Column({ type: 'int' })
  feedItemId: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehicleNumber?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantityKg: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
