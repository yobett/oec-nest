import { HttpService } from '@nestjs/common';
import * as path from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as crypto from 'crypto';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Like } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { ClientOptions } from 'ws';

import { Config } from './config';


const streamPipeline = promisify(pipeline);

// echo -n str | openssl md5
export function md5Digest(str: string): string {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}

export async function download(url: string, savePath: string, httpService: HttpService): Promise<unknown> {

  const targetPath = path.join(Config.STATIC_RES_DIR.BASE, savePath);

  if (existsSync(targetPath)) {
    console.log('File Existed: ' + targetPath);
    return null;
  }

  const requestConfig: AxiosRequestConfig = defaultReqConfig();
  requestConfig.responseType = 'stream';
  const response: AxiosResponse = await httpService.get(url, requestConfig).toPromise();
  console.log('Fetch: ' + url);

  if (response.status !== 200) throw new Error(`下载失败：${response.statusText}`);

  console.log('Save to: ' + targetPath);

  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true});
  }

  await streamPipeline(response.data, createWriteStream(targetPath));

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

export function defaultWsOptions(): ClientOptions {
  const hrc = Config.HttpRequestConfig;
  const wsOptions: ClientOptions = {};
  if (hrc.proxyEnabled) {
    const proxy = hrc.proxy;
    wsOptions.agent = new SocksProxyAgent(`${proxy.protocol}://${proxy.host}:${proxy.port}`);
  }
  return wsOptions;
}

export function toFixedDown(val: string | number,
                            digits = 2): string {
  return roundDown(val, digits, 'fraction');
}

export function roundDown(val: string | number,
                          digits = 5,
                          type: 'effect' | 'fraction' = 'effect'): string {
  return roundNumber(val, digits, type, true);
}

// type=effect: 指定有效位，type=fraction：指定小数位
// floor：向下取整
export function roundNumber(val: string | number,
                            digits = 5,
                            type: 'effect' | 'fraction' = 'effect',
                            floor = false): string {
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
    const nss = roundNumber(ns, digits, type, floor);
    return nss + ep;
  }
  const di = str.indexOf('.');
  if (di === -1) {
    return str;
  }
  if (type === 'effect') {
    if (floor && di >= digits) {
      return str.substr(0, di);
    }
    if (str.length - 1 <= digits) {
      return str;
    }
  }
  if (type === 'fraction' && str.length - 1 <= di + digits) {
    return str;
  }

  let fractionDigits;
  if (type === 'fraction') {
    fractionDigits = digits;
  } else {
    fractionDigits = digits - di;
    if (fractionDigits < 0) {
      fractionDigits = 0;
    }
    if (str.startsWith('0.')) {
      fractionDigits++;
    }
  }

  if (type === 'fraction') {
    if (floor) {
      return str.substr(0, di + 1 + fractionDigits);
    }
    return num.toFixed(fractionDigits);
  }

  // type === 'effect'

  if (!str.startsWith('0.')) {
    if (floor) {
      return str.substr(0, digits + 1);
    }
    return num.toFixed(fractionDigits);
  }

  // 0.0*x
  let fraction = fractionDigits;
  for (let i = 2; i < str.length; i++) {
    if (str.charAt(i) === '0') {
      fraction++;
    } else {
      break;
    }
  }
  if (str.length <= fraction + 2) {
    return str;
  }
  if (floor) {
    return str.substr(0, fraction + 2);
  }
  return num.toFixed(fraction);
}

export function setWildcardCondition<T>(where: FindConditions<T>, fieldName: string, value: string) {
  if (!value) {
    return;
  }
  if (/[*%_]/.test(value)) {
    const baseCcyLike = value.replace(/\*/g, '%');
    where[fieldName] = Like(baseCcyLike);
  } else {
    where[fieldName] = value;
  }
}
