import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config as dotenvConfig } from 'dotenv';
import { AppController } from '@/src/app.controller';
import { AppService } from '@/src/app.service';
import { UserModule } from '@/src/user/user.module';
import { AuthModule } from '@/src/auth/auth.module';
import { ShedModule } from '@/src/sheds/shed.module';
import { PartyModule } from '@/src/parties/party.module';
import { FeedItemModule } from '@/src/feed-items/feed-item.module';
import { DailyReportModule } from '@/src/daily-reports/daily-report.module';
import { SaleModule } from '@/src/sales/sale.module';
import { FeedReceiptModule } from '@/src/feed-receipts/feed-receipt.module';
import { ShedDailyReportModule } from '@/src/shed-daily-reports/shed-daily-report.module';
import { SeedModule } from '@/src/seed/seed.module';

dotenvConfig();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE || 'database.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Set to false in production
      logging: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UserModule,
    ShedModule,
    PartyModule,
    FeedItemModule,
    DailyReportModule,
    SaleModule,
    FeedReceiptModule,
    ShedDailyReportModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
