export class QueryParams {
  pager: Pager;
  filter: any;
  sorter?: Sorter;

  static parseQuery(query: any): QueryParams {
    const qp = new QueryParams();

    qp.pager = new Pager(query.page, query.pageSize);
    delete query.page;
    delete query.pageSize;

    if (query.sort) {
      const sortDir = query.sortDir || 'ASC';
      qp.sorter = new Sorter(query.sort, sortDir);
      delete query.sort;
      delete query.sortDir;
    }

    qp.filter = query;

    return qp;
  }

  static parseBoolean(boolValue: boolean | string, undefineAs = false): boolean {
    if (typeof boolValue === 'undefined') {
      return undefineAs;
    }
    if (typeof boolValue === 'boolean') {
      return boolValue;
    }
    boolValue = boolValue.toLowerCase();
    return boolValue === 'true' || boolValue === 'yes' || boolValue === 'y' || boolValue === '1';
  }
}

export class Pager {
  page?: number = 0;
  pageSize?: number = 10;

  get skip(): number {
    return this.pageSize * this.page;
  }

  constructor(page?: number, pageSize?: number) {
    if (!isNaN(page)) {
      this.page = +page;
    }
    if (!isNaN(pageSize)) {
      this.pageSize = +pageSize;
    }
  }
}

export class Sorter {
  sort: string;
  sortDir: string;

  constructor(sort: string, sortDir: string) {
    this.sort = sort;
    this.sortDir = sortDir;
  }
}
