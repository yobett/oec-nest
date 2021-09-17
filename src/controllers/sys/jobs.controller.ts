import { Controller, Get, UseGuards } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule/dist/scheduler.registry';
import { CronJob } from 'cron';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';


@Controller('sys/jobs')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class JobsController {

  constructor(private schedulerRegistry: SchedulerRegistry) {
  }


  @Get()
  all(): string[] {
    const jobsMap: Map<string, CronJob> = this.schedulerRegistry.getCronJobs();
    const jobs = [];
    for (const [name, job] of jobsMap.entries()) {
      jobs.push(`${name}, next run: ${job.nextDate().toLocaleString()}`)
    }
    return jobs;
  }
}
