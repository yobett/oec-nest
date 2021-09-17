export class Result {
  code = 0;
  message?: string;

  static success(): Result {
    return {code: 0};
  }

  static fail(message: string): Result {
    return {code: -1, message};
  }
}

export class ValueResult<T> extends Result {

  value?: T;

  static value<VT>(v: VT): ValueResult<VT> {
    return {code: 0, value: v};
  }
}

export class ListResult<T> extends Result {

  list?: T[];

  static list<S>(v: S[]): ListResult<S> {
    return {code: 0, list: v};
  }
}

export class CountListResult<T> extends Result {

  countList?: CountList<T>;

  static cl<S>(countList: CountList<S>): CountListResult<S> {
    return {code: 0, countList};
  }
}

export interface CountList<T> {
  count: number;
  list: T[],
}
