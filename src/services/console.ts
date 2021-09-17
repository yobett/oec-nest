import { BootstrapConsole } from 'nestjs-console';
import { ServiceModule } from './service.module';

const bootstrap = new BootstrapConsole({
  module: ServiceModule,
  useDecorators: true
});
bootstrap.init().then(async (app) => {
  try {
    await app.init();
    await bootstrap.boot();
    await app.close();
  } catch (e) {
    console.error(e);
    await app.close();
    process.exit(1);
  }
});
