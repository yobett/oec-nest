import { QueryRunner } from 'typeorm';
import debug0 from 'debug';
import { DebugLogger } from 'typeorm/logger/DebugLogger';

const debugOrm = debug0('oec:orm');
const debugSql = debug0('oec:sql');

export class TypeormLogger extends DebugLogger {
  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): any {
    debugOrm(message);
  }

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): any {
    debugSql(query);
    debugSql('Params: ' + (parameters || ''));
  }

}
