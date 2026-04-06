import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PartyType = 'SUPPLIER' | 'CUSTOMER' | 'BOTH';

@Entity('parties')
export class Party {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['SUPPLIER', 'CUSTOMER', 'BOTH'],
  })
  type: PartyType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
