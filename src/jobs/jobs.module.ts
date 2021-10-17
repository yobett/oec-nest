import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PriSyncTasks } from './pri-sync-tasks';
import { ServiceModule } from '../services/service.module';
import { PubSyncTasks } from './pub-sync-tasks';
import { StrategyTasks } from './strategy-tasks';
import { PriceMonitorTasks } from './price-monitor-tasks';

const tasks = [
  PriSyncTasks,
  PubSyncTasks,
  StrategyTasks,
  PriceMonitorTasks
];

@Module({
    imports: [
      ScheduleModule.forRoot(),
      ServiceModule,
    ],
    providers: tasks,
    exports: tasks
  }
)
export class JobsModule {

}
