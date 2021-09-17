import fetch from 'node-fetch';
import * as path from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as crypto from 'crypto';
import { AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

import { Config } from './config';


const streamPipeline = promisify(pipeline);

// echo -n str | openssl md5
export function md5Digest(str: string): string {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}

export async function download(url: string, savePath: string): Promise<unknown> {

  const targetPath = path.join(Config.STATIC_RES_DIR.BASE, savePath);

  if (existsSync(targetPath)) {
    console.log('File Existed: ' + targetPath);
    return null;
  }

  const response = await fetch(url);
  console.log('Fetch: ' + url);

  if (!response.ok) throw new Error(`下载失败：${response.statusText}`);

  console.log('Save to: ' + targetPath);

  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true});
  }

  await streamPipeline(response.body, createWriteStream(targetPath));

  return null;
}

export function defaultReqConfig(): AxiosRequestConfig {
  const hrc = Config.HttpRequestConfig;
  const requestConfig: AxiosRequestConfig = {
    timeout: hrc.timeout
  };
  if (hrc.proxyEnabled) {
    const proxy = hrc.proxy;
    const agent = new SocksProxyAgent(`${proxy.protocol}://${proxy.host}:${proxy.port}`);
    requestConfig.proxy = false;
    requestConfig.httpsAgent = agent;
    requestConfig.httpAgent = agent;
  }
  return requestConfig;
}

// 取有效位，1234.567 -> 1234.6, 0.001201100003 -> 0.0012011
export function effectDigitsTransform(val: string | number, digits = 5): string {
  if (typeof val === 'undefined') {
    return '';
  }
  if (val == null) {
    return '';
  }
  let str: string;
  let num: number;
  if (typeof val === 'number') {
    if (isNaN(val)) {
      return '';
    }
    str = '' + val;
    num = val;
  } else {
    if (val === '') {
      return '';
    }
    str = val;
    num = +val;
  }
  if (/\d[eE]-\d+$/.test(str)) {
    const index = /[eE]-\d+$/.exec(str).index;
    const ns = str.substring(0, index);
    const ep = str.substring(index);
    const nss = effectDigitsTransform(ns, digits);
    return nss + ep;
  }
  const di = str.indexOf('.');
  if (di === -1) {
    return str;
  }
  if (str.length - 1 <= digits) {
    return str;
  }
  if (!str.startsWith('0.')) {
    let frac = digits - di;
    if (frac < 0) {
      frac = 0;
    }
    return num.toFixed(frac);
  }
  let fraction = digits;
  for (let i = 2; i < str.length; i++) {
    if (str.charAt(i) === '0') {
      fraction++;
    } else {
      break;
    }
  }
  if (fraction > str.length - di - 1) {
    return str;
  }
  return num.toFixed(fraction);
}
