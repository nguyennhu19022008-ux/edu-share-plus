import type { TradeType } from './types';

export const PAGE_SIZE = 12;
export const CATEGORIES = ['Sách','Sách giáo khoa','Sách tham khảo','Dụng cụ học tập','Vở','Bút','Đồng phục','Đồ điện tử nhỏ','Khác'];
export const TRADE_TYPES: TradeType[] = ['Cho mượn','Cho tặng','Trao đổi','Bán giá rẻ'];

export function normalizeMarketText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

export function formatMarketMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

export function formatMarketCardDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/\d{4}\s+(\d{2}:\d{2})/);
  return match ? `${match[3]} • ${match[1]}/${match[2]}` : value;
}

export function marketTradeClass(value: TradeType) {
  if (value === 'Bán giá rẻ') return 'sale';
  if (value === 'Cho tặng') return 'gift';
  if (value === 'Cho mượn') return 'loan';
  return 'exchange';
}

export function marketReputationTone(score: number) {
  if (score >= 8) return 'excellent';
  if (score >= 6) return 'good';
  if (score >= 4) return 'normal';
  return 'caution';
}

export function compactMarketPageList(totalPages:number, activePage:number): Array<number|'...'> {
  if (totalPages <= 7) return Array.from({ length:totalPages },(_,index)=>index+1);
  const pages:Array<number|'...'>=[1];
  const start=Math.max(2,activePage-1), end=Math.min(totalPages-1,activePage+1);
  if(start>2) pages.push('...');
  for(let page=start; page<=end; page++) pages.push(page);
  if(end<totalPages-1) pages.push('...');
  pages.push(totalPages);
  return pages;
}
