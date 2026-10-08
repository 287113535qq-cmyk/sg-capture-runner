// 写入每条真实采集记录，便于识别旧客户端混写和后续数据清理。
import {capturePlatform} from './ag.platform';
export const AG_CAPTURE_VERSION = capturePlatform()==='sg'?'2026-10-09-whole-ag-sg-v2':'2026-09-05-round-replay-v4';

export const AG_CAPTURE_SOURCE = capturePlatform()==='sg'?'sg-via-ag-live':'ag-live';
