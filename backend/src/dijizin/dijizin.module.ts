import { Module } from '@nestjs/common';
import { DijizinService } from './dijizin.service';

@Module({
  providers: [DijizinService],
  exports: [DijizinService],
})
export class DijizinModule {}
