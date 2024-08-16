import { Module } from '@nestjs/common';
import { BlockService } from './block.service';
import { RepoModule } from '../repo/repo.module';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [RepoModule, RpcModule],
  providers: [BlockService],
  controllers: [],
})
export class BlockModule {}
