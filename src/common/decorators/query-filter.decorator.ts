import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { QueryParams } from '../../models/query-params';
import debug0 from 'debug';

const debugQuery = debug0('oec:query');

export const QueryFilter = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const qp = QueryParams.parseQuery(request.query);
    debugQuery(qp);
    return qp;
  },
);
