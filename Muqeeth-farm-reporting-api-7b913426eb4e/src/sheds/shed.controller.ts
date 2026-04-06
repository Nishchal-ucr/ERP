import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ShedService } from './shed.service';

@Controller('api/sheds')
export class ShedController {
  constructor(private readonly shedService: ShedService) {}

  @Get()
  async findAll() {
    return this.shedService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shedService.findOne(id);
  }
}
