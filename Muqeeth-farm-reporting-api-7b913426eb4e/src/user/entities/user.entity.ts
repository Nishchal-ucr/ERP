import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number; // Changed to number for SQLite compatibility

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, enum: ['OWNER', 'SUPERVISOR'] })
  role: 'OWNER' | 'SUPERVISOR';

  @CreateDateColumn()
  createdAt: Date;
}
