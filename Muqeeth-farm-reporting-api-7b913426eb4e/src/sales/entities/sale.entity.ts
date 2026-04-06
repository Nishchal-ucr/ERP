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

@Entity('sales')
export class Sale {
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

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehicleNumber?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
