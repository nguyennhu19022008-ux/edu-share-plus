import { compactMarketPageList } from '../viewUtils';

export default function MarketplacePagination({ totalPages, safePage, filteredCount, onChange }:{ totalPages:number; safePage:number; filteredCount:number; onChange:(page:number)=>void }) {
  return (
    <div className="pagination-wrap">
      {totalPages<=1 ? <span className="page-info">{filteredCount} bài phù hợp</span> : <>
        <button className="page-btn" type="button" disabled={safePage<=1} onClick={()=>onChange(safePage-1)}>‹</button>
        {compactMarketPageList(totalPages,safePage).map((item,index)=>item==='...' ? <span className="page-info" key={`ellipsis-${index}`}>...</span> : <button className={`page-btn${item===safePage?' active':''}`} type="button" key={item} onClick={()=>onChange(item)}>{item}</button>)}
        <button className="page-btn" type="button" disabled={safePage>=totalPages} onClick={()=>onChange(safePage+1)}>›</button>
        <span className="page-info">Trang {safePage}/{totalPages} • {filteredCount} bài phù hợp</span>
      </>}
    </div>
  );
}
