import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { Party } from '../parties/entities/party.entity';
import { FeedItem } from '../feed-items/entities/feed-item.entity';
import { Shed } from '../sheds/entities/shed.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(FeedItem)
    private feedItemRepository: Repository<FeedItem>,
    @InjectRepository(Shed)
    private shedRepository: Repository<Shed>,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting database seeding...');

      // Seed Users
      await this.seedUsers();

      // Seed Parties
      await this.seedParties();

      // Seed Feed Items
      await this.seedFeedItems();

      // Seed Sheds
      await this.seedSheds();

      this.logger.log('Database seeding completed successfully!');
    } catch (error) {
      this.logger.error('Error seeding database:', error);
      throw error;
    }
  }

  private async seedUsers(): Promise<void> {
    const userCount = await this.userRepository.count();

    if (userCount > 0) {
      this.logger.log('Users already exist. Skipping user seeding.');
      return;
    }

    const users = [
      {
        name: 'Supervisor One',
        phone: '9876543210',
        password: '22446688',
        role: 'SUPERVISOR' as const,
      },
      {
        name: 'Supervisor Two',
        phone: '9876543211',
        password: '22446688',
        role: 'SUPERVISOR' as const,
      },
      {
        name: 'Supervisor Three',
        phone: '9876543212',
        password: '22446688',
        role: 'SUPERVISOR' as const,
      },
    ];

    for (const userData of users) {
      const existingUser = await this.userRepository.findOne({
        where: { phone: userData.phone },
      });

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(userData.password, 10);
        const user = this.userRepository.create({
          name: userData.name,
          phone: userData.phone,
          passwordHash,
          role: userData.role,
        });
        await this.userRepository.save(user);
        this.logger.log(`Created user: ${userData.name}`);
      }
    }
  }

  private async seedParties(): Promise<void> {
    const partyCount = await this.partyRepository.count();

    if (partyCount > 0) {
      this.logger.log('Parties already exist. Skipping party seeding.');
      return;
    }

    const parties = [
      {
        name: 'Prime Feed Suppliers',
        type: 'SUPPLIER' as const,
        phone: '03111234567',
        address: 'Malkajgiri, Hyderabad',
      },
      {
        name: 'Quality Feed Exports',
        type: 'SUPPLIER' as const,
        phone: '03112345678',
        address: 'Uppal, Hyderabad',
      },
      {
        name: 'Livestock Distributors',
        type: 'BOTH' as const,
        phone: '03113456789',
        address: 'Shamshabad, Hyderabad',
      },
      {
        name: 'Poultry Trading Hub',
        type: 'BOTH' as const,
        phone: '03114567890',
        address: 'Manasanpalle, Hyderabad',
      },
      {
        name: 'Bulk Commodities Ltd',
        type: 'SUPPLIER' as const,
        phone: '03115678901',
        address: 'Choutuppal, Telangana',
      },
    ];

    for (const partyData of parties) {
      const existingParty = await this.partyRepository.findOne({
        where: { name: partyData.name },
      });

      if (!existingParty) {
        const party = this.partyRepository.create(partyData);
        await this.partyRepository.save(party);
        this.logger.log(`Created party: ${partyData.name}`);
      }
    }
  }

  private async seedFeedItems(): Promise<void> {
    const feedItemCount = await this.feedItemRepository.count();

    if (feedItemCount > 0) {
      this.logger.log('Feed items already exist. Skipping feed item seeding.');
      return;
    }

    const feedItems = [
      // Ingredients
      { name: 'Maize', category: 'INGREDIENT' as const },
      { name: 'Broken Rice', category: 'INGREDIENT' as const },
      { name: 'PARAM', category: 'INGREDIENT' as const },
      { name: 'Soya', category: 'INGREDIENT' as const },
      { name: 'DDGS', category: 'INGREDIENT' as const },
      { name: 'DORB', category: 'INGREDIENT' as const },
      { name: 'MDOC', category: 'INGREDIENT' as const },
      { name: 'DOGN', category: 'INGREDIENT' as const },
      { name: 'Soya Oil', category: 'INGREDIENT' as const },
      { name: 'Rice bran', category: 'INGREDIENT' as const },
      { name: 'MBM', category: 'INGREDIENT' as const },
      { name: 'Calcite', category: 'INGREDIENT' as const },
      { name: 'Stone', category: 'INGREDIENT' as const },

      // Medicines
      { name: 'MCP', category: 'MEDICINE' as const },
      { name: 'Methionine', category: 'MEDICINE' as const },
      { name: 'Lysine', category: 'MEDICINE' as const },
      { name: 'Threonine', category: 'MEDICINE' as const },
      { name: 'Salt', category: 'MEDICINE' as const },
      { name: 'Sodium_Bicarbonate', category: 'MEDICINE' as const },
      { name: 'Probiotic', category: 'MEDICINE' as const },
      { name: 'Vitamin Premix', category: 'MEDICINE' as const },
      { name: 'Trace Minerals (TM)', category: 'MEDICINE' as const },
      { name: 'Liver Tonic', category: 'MEDICINE' as const },
      { name: 'Toxin Binder', category: 'MEDICINE' as const },
      { name: 'Choline chloride', category: 'MEDICINE' as const },
      { name: 'Acidifire', category: 'MEDICINE' as const },
      { name: 'Enzymes', category: 'MEDICINE' as const },
      { name: 'Phytase', category: 'MEDICINE' as const },
      { name: 'Antibiotic', category: 'MEDICINE' as const },
      { name: 'Betaine', category: 'MEDICINE' as const },
    ];

    for (const feedItemData of feedItems) {
      const existingFeedItem = await this.feedItemRepository.findOne({
        where: { name: feedItemData.name },
      });

      if (!existingFeedItem) {
        const feedItem = this.feedItemRepository.create(feedItemData);
        await this.feedItemRepository.save(feedItem);
        this.logger.log(`Created feed item: ${feedItemData.name}`);
      }
    }
  }

  private async seedSheds(): Promise<void> {
    const shedCount = await this.shedRepository.count();

    if (shedCount > 0) {
      this.logger.log('Sheds already exist. Skipping shed seeding.');
      return;
    }

    const sheds = [
      {
        name: 'Shed 1',
        capacity: 43000,
        flockNumber: 'FK10092024',
        active: true,
      },
      {
        name: 'Shed 2',
        capacity: 43000,
        flockNumber: 'FK02022024',
        active: true,
      },
      {
        name: 'Shed 3',
        capacity: 43000,
        flockNumber: 'FK04212024',
        active: true,
      },
      {
        name: 'Shed 4',
        capacity: 43000,
        flockNumber: 'FK04162023',
        active: true,
      },
      {
        name: 'Shed 5',
        capacity: 43000,
        flockNumber: 'FK04162023',
        active: true,
      },
      {
        name: 'Grower 1',
        capacity: 50000,
        flockNumber: 'FK04262025',
        active: true,
      },
    ];

    for (const shedData of sheds) {
      const existingShed = await this.shedRepository.findOne({
        where: { name: shedData.name },
      });

      if (!existingShed) {
        const shed = this.shedRepository.create(shedData);
        await this.shedRepository.save(shed);
        this.logger.log(`Created shed: ${shedData.name}`);
      }
    }
  }
}
