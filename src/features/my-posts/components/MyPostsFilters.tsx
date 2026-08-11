import type { MyPostSort, MyPostStatus } from '../types';
import { MY_POST_STATUS_TABS } from '../viewUtils';

export default function MyPostsFilters({ status, keyword, sort, resultCount, countStatus, onStatus, onKeyword, onSort, onClear }:{
  status:''|MyPostStatus;
  keyword:string;
  sort:MyPostSort;
  resultCount:number;
  countStatus:(target:''|MyPostStatus)=>number;
  onStatus:(value:''|MyPostStatus)=>void;
  onKeyword:(value:string)=>void;
  onSort:(value:MyPostSort)=>void;
  onClear:()=>void;
}) {
  return (
    <section className="owner-controls-card" aria-label="Bộ lọc bài đăng của tôi">
      <div className="owner-controls-heading">
        <div>
          <span className="owner-controls-eyebrow">QUẢN LÝ BÀI ĐĂNG</span>
          <h2>Lọc và xử lý bài nhanh</h2>
        </div>
        <span className="owner-result-summary">{resultCount} bài phù hợp</span>
      </div>
      <div className="owner-status-tabs">
        {MY_POST_STATUS_TABS.map((tab) => {
          const count = countStatus(tab.value);
          return (
            <button key={tab.value || 'all'} className={`tab-btn${status === tab.value ? ' active' : ''}`} type="button" onClick={() => onStatus(tab.value)}>
              {tab.label}{count ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
      <div className="owner-filter-row">
        <label className="owner-filter-field owner-filter-search">
          <span>Tìm kiếm</span>
          <input value={keyword} onChange={(event) => onKeyword(event.target.value)} placeholder="Tìm theo tiêu đề, danh mục, mô tả..." />
        </label>
        <label className="owner-filter-field owner-filter-sort">
          <span>Sắp xếp</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as MyPostSort)}>
            <option value="new">Mới nhất</option>
            <option value="contacts">Nhiều người quan tâm</option>
            <option value="comments">Nhiều bình luận</option>
            <option value="needAction">Cần xử lý trước</option>
          </select>
        </label>
        <button className="owner-clear-filter" type="button" onClick={onClear}>Xóa lọc</button>
      </div>
    </section>
  );
}
