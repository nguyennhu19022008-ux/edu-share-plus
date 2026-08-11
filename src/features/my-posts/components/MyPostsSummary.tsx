export type MyPostsDashboard = { total:number; open:number; done:number; needAction:number };

export default function MyPostsSummary({ dashboard }:{ dashboard:MyPostsDashboard }) {
  return (
    <section className="owner-dashboard-compact" aria-label="Tổng quan bài đăng">
      <SummaryCard label="Tổng bài" value={dashboard.total} mark="▦" tone="blue" />
      <SummaryCard label="Đang giao dịch" value={dashboard.open} mark="↻" tone="green" />
      <SummaryCard label="Hoàn tất" value={dashboard.done} mark="✓" tone="teal" />
      <SummaryCard label="Cần xử lý" value={dashboard.needAction} mark="!" tone="orange" />
    </section>
  );
}

function SummaryCard({ label, value, mark, tone }:{ label:string; value:number; mark:string; tone:'blue'|'green'|'teal'|'orange' }) {
  return (
    <article className={`owner-summary-card ${tone}`}>
      <div className="owner-summary-copy"><span>{label}</span><b>{value}</b></div>
      <span className="owner-summary-mark" aria-hidden="true">{mark}</span>
    </article>
  );
}
