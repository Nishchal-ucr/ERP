import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PartyService } from './party.service';

@Controller('api/parties')
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Get()
  async findAll() {
    return this.partyService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partyService.findOne(id);
  }
}
