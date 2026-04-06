import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { DailyReport } from '../../daily-reports/entities/daily-report.entity';
import { Shed } from '../../sheds/entities/shed.entity';

@Entity('shed_daily_reports')
@Unique(['dailyReportId', 'shedId'])
export class ShedDailyReport {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => DailyReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'daily_report_id' })
  dailyReport: DailyReport;

  @Column({ type: 'int' })
  dailyReportId: number;

  @ManyToOne(() => Shed)
  @JoinColumn({ name: 'shed_id' })
  shed: Shed;

  @Column({ type: 'int' })
  shedId: number;

  @Column({ type: 'int', nullable: true })
  birdsMortality?: number;

  @Column({ type: 'int', nullable: true })
  closingBirds?: number;

  @Column({ type: 'int', nullable: true })
  damagedEggs?: number;

  @Column({ type: 'int', nullable: true })
  standardEggsClosing?: number;

  @Column({ type: 'int', nullable: true })
  smallEggsClosing?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalFeedReceipt?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closingFeed?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
