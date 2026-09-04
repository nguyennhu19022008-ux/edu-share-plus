import { useMemo } from 'react';
import type { AdminPost, AdminPostStatus } from '../types';

export function AdminSummaryCard({label,value,note,tone,icon}:{label:string;value:string|number;note:string;tone:string;icon:string}) {
  return <article className={`admin-summary-card tone-${tone}`}><div className="admin-summary-card-head"><span className="admin-summary-label">{label}</span><span className="admin-summary-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

export function AdminRate({label,value,tone}:{label:string;value:number;tone:'green'|'blue'|'red'}) {
  const safe = Math.max(0,Math.min(100,value));
  return <div className="admin-rate-item"><div className="admin-rate-row"><span>{label}</span><b className={`rate-${tone}`}>{safe.toFixed(1)}%</b></div><div className="admin-rate-track"><i className={`rate-${tone}`} style={{width:`${Math.max(tone==='red'&&safe>0?2:0,safe)}%`}} /></div></div>;
}

export function AdminRankColumn({title,items,isClass=false}:{title:string;items:Array<{name:string;count:number}>;isClass?:boolean}) {
  return <div className="admin-rank-column"><h3>{title}</h3><div className="admin-rank-list">{items.length ? items.slice(0,5).map((item,index)=><div key={item.name} className={`admin-rank-row${isClass&&index===0?' featured':''}`}><span>{`${index+1}. `}{item.name}</span><b>{item.count}{isClass?' lượt':' món'}</b></div>) : <div className="admin-rank-empty">Chưa có dữ liệu.</div>}</div></div>;
}

export function AdminSwitch({checked,disabled,label,onChange}:{checked:boolean;disabled:boolean;label:string;onChange:(checked:boolean)=>void}) {
  return <label className={`admin-switch${disabled?' is-disabled':''}`} title={label}><input className="admin-switch-input" type="checkbox" checked={checked} disabled={disabled} onChange={(event)=>onChange(event.target.checked)} aria-label={label}/><span className="admin-switch-track" aria-hidden="true"><span className="admin-switch-thumb"/></span></label>;
}

export function AdminModalMeta({label,value}:{label:string;value:string}) {
  return <div className="admin-modal-meta"><span>{label}</span><strong>{value || 'Chưa có'}</strong></div>;
}

export function AdminCharts({posts}:{posts:AdminPost[]}) {
  const { monthLabels, monthValues } = useMemo(() => {
    const postMonths = new Set<string>();
    posts.forEach((post) => {
      const d = new Date(post.dateTs || post.date);
      if (!isNaN(d.getTime())) {
        const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        postMonths.add(key);
      }
    });

    if (postMonths.size === 0) {
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        postMonths.add(key);
      }
    }

    const sortedMonths = Array.from(postMonths).sort((a, b) => {
      const [mA, yA] = a.split('/').map(Number);
      const [mB, yB] = b.split('/').map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    });

    const map = new Map<string, number>();
    sortedMonths.forEach((m) => map.set(m, 0));

    posts.forEach((post) => {
      const d = new Date(post.dateTs || post.date);
      if (!isNaN(d.getTime())) {
        const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        if (map.has(key)) {
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    });

    return {
      monthLabels: [...map.keys()],
      monthValues: [...map.values()],
    };
  }, [posts]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((post) => map.set(post.category, (map.get(post.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [posts]);

  const trades = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((post) => map.set(post.tradeType, (map.get(post.tradeType) || 0) + 1));
    return [...map.entries()];
  }, [posts]);

  const hot = useMemo(
    () =>
      [...posts]
        .sort(
          (a, b) =>
            b.favoriteCount + b.contactCount + b.commentCount - (a.favoriteCount + a.contactCount + a.commentCount) ||
            b.dateTs - a.dateTs
        )
        .slice(0, 5),
    [posts]
  );

  return (
    <section className="admin-chart-dashboard">
      <div className="admin-chart-heading">
        <div>
          <h2>Biểu đồ dashboard</h2>
          <p>Theo dõi xu hướng hoàn tất, danh mục, hình thức giao dịch và bài nổi bật.</p>
        </div>
        <span className="admin-card-note">Chart.js • Dữ liệu thực tế</span>
      </div>
      <div className="admin-chart-grid">
        <article className="admin-chart-panel">
          <h3>Hoàn tất theo tháng</h3>
          <div className="admin-chart-canvas">
            <LineChart labels={monthLabels} values={monthValues} />
          </div>
        </article>
        <article className="admin-chart-panel">
          <h3>Tác động theo danh mục</h3>
          <div className="admin-chart-canvas">
            <BarChart items={categories} />
          </div>
        </article>
        <article className="admin-chart-panel">
          <h3>Cơ cấu hình thức</h3>
          <div className="admin-chart-canvas">
            <DonutChart items={trades} />
          </div>
        </article>
        <article className="admin-chart-panel">
          <h3>Top bài nổi bật</h3>
          <div className="admin-chart-canvas">
            <HotChart items={hot} />
          </div>
        </article>
      </div>
    </section>
  );
}

function LineChart({ labels, values }: { labels?: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  const width = 460,
    height = 165,
    pad = 14;
  const points = values
    .map(
      (value, index) =>
        `${pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1)},${
          height - pad - (value / max) * (height - pad * 2)
        }`
    )
    .join(' ');
  const axisLabels = labels && labels.length ? labels : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
  return (
    <div className="admin-local-line">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ hoàn tất theo tháng">
        <g className="admin-local-grid">
          <line x1="14" y1="40" x2="446" y2="40" />
          <line x1="14" y1="82" x2="446" y2="82" />
          <line x1="14" y1="124" x2="446" y2="124" />
        </g>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((value, index) => {
          const [x, y] = points.split(' ')[index].split(',');
          return (
            <circle key={index} cx={x} cy={y} r="4" fill="currentColor">
              <title>{value} giao dịch</title>
            </circle>
          );
        })}
      </svg>
      <div className="admin-local-months">
        {axisLabels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: Array<[string, number]> }) {
  const max = Math.max(...items.map(([, value]) => value), 1);
  return (
    <div className="admin-local-bars">
      {items.map(([label, value]) => (
        <div className="admin-local-bar" key={label}>
          <span>{label}</span>
          <i>
            <b style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
          </i>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ items }: { items: Array<[string, number]> }) {
  const total = items.reduce((sum, [, value]) => sum + value, 0) || 1;
  let cursor = 0;
  const colors = ['#ee4d2d', '#f59e0b', '#10b981', '#2563eb'];
  const segments = items
    .map(([, value], index) => {
      const start = cursor;
      cursor += (value / total) * 360;
      return `${colors[index % colors.length]} ${start}deg ${cursor}deg`;
    })
    .join(',');
  return (
    <div className="admin-local-donut-wrap">
      <div className="admin-local-donut" style={{ background: `conic-gradient(${segments})` }}>
        <span>
          <b>{total}</b>
          <small>bài đăng</small>
        </span>
      </div>
      <div className="admin-local-legend">
        {items.map(([label, value], index) => (
          <div key={label}>
            <i style={{ background: colors[index % colors.length] }} />
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function HotChart({ items }: { items: AdminPost[] }) {
  const values = items.map((post) => post.favoriteCount + post.contactCount + post.commentCount + 1);
  const max = Math.max(...values, 1);
  return (
    <div className="admin-local-hot">
      {items.map((post, index) => (
        <div key={post.id}>
          <span title={post.title}>{post.title}</span>
          <i>
            <b style={{ width: `${(values[index] / max) * 100}%` }} />
          </i>
          <strong>{values[index]}</strong>
        </div>
      ))}
    </div>
  );
}

export function ShieldIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.3 20 5v5.8c0 5.1-3.4 9.4-8 10.9-4.6-1.5-8-5.8-8-10.9V5l8-2.7Zm0 4.1-4.6 1.5v3c0 3.2 1.9 6.1 4.6 7.4 2.7-1.3 4.6-4.2 4.6-7.4v-3L12 6.4Z"/></svg>}
export function BellIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8.2 11a2.4 2.4 0 0 0 4.4 0H9.8Z"/></svg>}
export function LogoutIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm4.6 4.6L13.2 9l2 2H8v2h7.2l-2 2 1.4 1.4L19 12l-4.4-4.4Z"/></svg>}
export function RefreshIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z"/></svg>}
export function DocumentIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 3.5L18.5 9H15V5.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z"/></svg>}
export function CheckIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 16.2-3.5-3.5L4 14.2l5 5 11-11-1.5-1.4L9 16.2Zm0-6-1.5 1.5L9 13.2l7-7-1.5-1.4L9 10.2Z"/></svg>}
export function SearchIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4l5.2 5.2 1.4-1.4ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"/></svg>}

export function adminStatusLabel(value:AdminPostStatus):string {
  if (value === 'Đang mở') return 'Đang giao dịch';
  if (value === 'Đã xong') return 'Đã hoàn tất';
  return value;
}

export function adminStatusClass(value:AdminPostStatus):string {
  const map:Record<AdminPostStatus,string> = {
    'Đang mở':'open', 'Chờ duyệt':'pending', 'Đã xong':'done', 'Từ chối':'rejected', 'Đã thu hồi':'withdrawn',
  };
  return map[value];
}
