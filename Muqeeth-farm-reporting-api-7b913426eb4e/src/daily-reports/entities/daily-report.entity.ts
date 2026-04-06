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
import { User } from '../../user/entities/user.entity';

export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

@Entity('daily_reports')
@Unique(['reportDate'])
export class DailyReport {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  reportDate: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_user' })
  createdByUser: User;

  @Column({ type: 'int' })
  createdByUserId: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['DRAFT', 'SUBMITTED', 'LOCKED'],
    default: 'DRAFT',
  })
  status: DailyReportStatus;

  @Column({ type: 'datetime', nullable: true })
  submittedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
