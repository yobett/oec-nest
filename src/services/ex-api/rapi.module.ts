import { HttpModule, Module } from '@nestjs/common';
import { Provider } from '@nestjs/common/interfaces/modules/provider.interface';
import { OePubApiService } from './oe/oe-pub-api.service';
import { OePriApiService } from './oe/oe-pri-api.service';
import { BaPubApiService } from './ba/ba-pub-api.service';
import { BaPriApiService } from './ba/ba-pri-api.service';
import { HbPubApiService } from './hb/hb-pub-api.service';
import { HbPriApiService } from './hb/hb-pri-api.service';
import { CmcApiService } from './cmc/cmc-api.service';
import { OePubWsService } from './oe/oe-pub-ws.service';

const services: Provider[] = [
  OePubApiService, OePriApiService, OePubWsService,
  BaPubApiService, BaPriApiService,
  HbPubApiService, HbPriApiService,
  CmcApiService
];

@Module({
  imports: [
    HttpModule,
  ],
  providers: services,
  exports: services
})
export class RapiModule {
}
