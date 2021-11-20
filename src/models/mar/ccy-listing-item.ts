import { Quote } from './quote';
import { Ccy } from './ccy';

interface CcyListingItemBase {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  date_added: string;
  tags: string[];
  cmc_rank: number;
  max_supply: number;
  circulating_supply: number;
  total_supply: number;
}

export interface CcyListingItemRaw extends CcyListingItemBase {

  quote: { [convert: string]: Quote };
}

export interface CcyListingItem extends CcyListingItemBase {

  // USD
  quote: Quote;
  ccy?: Ccy;
}

export interface CcyListingWithStatus {
  status: {
    error_code: number;
    error_message: string;
    total_count: number;
  };
  data: CcyListingItemRaw[];
}
