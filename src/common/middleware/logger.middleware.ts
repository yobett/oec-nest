import { Injectable, NestMiddleware } from '@nestjs/common';
import debug0 from "debug";

const debugHeaders = debug0('oec:http:head');
const debugQuery = debug0('oec:http:query');
const debugBody = debug0('oec:http:body');


function emptyObject(obj): boolean {
  if (typeof obj !== 'object') {
    return true;
  }
  const has = Object.prototype.hasOwnProperty;
  for (const key in obj) {
    if (has.call(obj, key)) return false;
  }
  return true;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {

    console.log('========= ' + req.ip);
    if (req.method === 'OPTIONS') {
      return next();
    }
    // debugHeaders(JSON.stringify(req.headers, null, 2));
    if (!emptyObject(req.query)) {
      debugQuery(JSON.stringify(req.query, null, 2));
    }
    if (req.method !== 'GET' && !emptyObject(req.body)) {
      debugBody(JSON.stringify(req.body, null, 2));
    }

    next();
  }
}
