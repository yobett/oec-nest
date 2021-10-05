import { ConfigLocal } from './config-local';

const {
  JwtSecret,
  SiteSalt,
  DB,
  HttpRequestConfig,
  STATIC_RES_DIR
} = ConfigLocal;

// https://momentjs.com/timezone/
const Timezone = 'Asia/Shanghai';

const JwtExpiresIn = '30d';

const OE_API = {
  BASE_URL: 'https://www.okex.com',
  WS_PUBLIC: 'wss://ws.okex.com:8443/ws/v5/public',
  WS_PRIVATE: 'wss://ws.okex.com:8443/ws/v5/private'
};

const BA_API = {
  BASE_URL: 'https://api.binance.com', // -or- api1/api2/api3
  WS_PUBLIC: '',
  WS_PRIVATE: ''
};

const HB_API_DOMAIN = 'api.huobi.pro';  // -or- api-aws.huobi.pro
const HB_API = {
  DOMAIN: HB_API_DOMAIN,
  BASE_URL: 'https://' + HB_API_DOMAIN,
  WS_PUBLIC: '',
  WS_PRIVATE: ''
};

const CMC_API = {
  BASE_URL: 'https://pro-api.coinmarketcap.com'
};

const EX_DATA_SYNC = {
  UPDATE_ASSET_THRESHOLD: 1e-5
};

const Minute = 60 * 1000;

const StrategyWatchInterval = {
  loose: 80 * Minute,
  medium: 20 * Minute,
  intense: 5 * Minute,
};

const StrategyConfig = {
  TradingPriceDeltaPercent: 1
}

const OrderIdPrefix = 'oec';

const ClientOrderIdPrefixes = {
  web: OrderIdPrefix + 'm',
  strategy: OrderIdPrefix + 'a'
};

const PlaceOrderSyncDelay = 2 * 1000; // 2s

export const Config = {
  JwtSecret,
  SiteSalt,
  DB,
  HttpRequestConfig,
  STATIC_RES_DIR,
  Timezone,
  JwtExpiresIn,
  OE_API,
  BA_API,
  HB_API,
  CMC_API,
  EX_DATA_SYNC,
  StrategyWatchInterval,
  StrategyConfig,
  ClientOrderIdPrefixes,
  PlaceOrderSyncDelay
}
