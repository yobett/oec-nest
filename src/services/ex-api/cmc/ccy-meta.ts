export interface CcyMeta {
  name: string;
  symbol: string;
  category: string;
  description: string;
  slug: string;
  logo: string;
  subreddit: string;
  notice: string;
  'tag-names': string;
  urls: CcyMetaUrls;
}

export interface CcyMetaUrls {
  website: string[];
  twitter: string[];
  message_board: string[];
  chat: string[];
  explorer: string[];
  reddit: string[];
  technical_doc: string[];
  source_code: string[];
  announcement: string[];
}
