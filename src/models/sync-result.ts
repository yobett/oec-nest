export class SyncResult {
  create = 0;
  update = 0;
  skip = 0;
  payload?: any;
}

export interface SyncResults {
  [ex: string]: SyncResult;
}
