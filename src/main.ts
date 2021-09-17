import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as morgan from 'morgan';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('/oec/api');
  app.useGlobalFilters(new AllExceptionsFilter());
  const env = process.env;
  app.use(morgan(env.NODE_ENV === 'prod' ? 'tiny' : 'dev'));
  const port = env.OEC_PORT || 3000;
  await app.listen(port);
  const url = await app.getUrl();
  Logger.log(`Listening on: ${url}`);
}

bootstrap();
