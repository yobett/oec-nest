import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';

const DB_CONFIG: MysqlConnectionOptions = {
  type: 'mariadb', // "mysql" | "mariadb"
  host: '127.0.0.1',
  port: 3306,
  username: 'oecu',
  password: '123',
  database: 'oec'
};

const HttpRequestConfig = {
  timeout: 5000,
  proxyEnabled: false,
  proxy: {
    host: '127.0.0.1',
    port: 1080,
    protocol: 'socks'
  }
};

const STATIC_RES_DIR = {
  BASE: '/usr/node/html',
  coins: '/coins'
};

export const ConfigLocal = {
  JwtSecret: 'aygey45454',
  SiteSalt: 'ertyty6735',
  DB: DB_CONFIG,
  HttpRequestConfig,
  STATIC_RES_DIR
};
