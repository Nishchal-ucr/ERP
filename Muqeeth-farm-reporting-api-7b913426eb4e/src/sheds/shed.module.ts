import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShedService } from './shed.service';
import { ShedController } from './shed.controller';
import { Shed } from './entities/shed.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shed])],
  controllers: [ShedController],
  providers: [ShedService],
  exports: [ShedService],
})
export class ShedModule {}
