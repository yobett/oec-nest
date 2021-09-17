import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PriSyncTasks } from './pri-sync-tasks';
import { ServiceModule } from '../services/service.module';
import { PubSyncTasks } from './pub-sync-tasks';
import { StrategyTasks } from './strategy-tasks';

const tasks = [
  PriSyncTasks,
  PubSyncTasks,
  StrategyTasks
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
