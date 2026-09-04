import React from 'react';

export function SkeletonBox({
  width,
  height,
  borderRadius = '8px',
  className = '',
  style = {},
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '1rem',
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonMarketplaceCard() {
  return (
    <article className="post-card market-product-card skeleton-card">
      <div className="market-product-card-body">
        <div className="market-product-card-top" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <SkeletonBox width={70} height={22} borderRadius={4} />
            <SkeletonBox width={90} height={22} borderRadius={4} />
          </div>
          <SkeletonBox width={80} height={22} borderRadius={4} />
        </div>
        <SkeletonBox width="85%" height={26} borderRadius={4} style={{ marginBottom: 10 }} />
        <SkeletonBox width="60%" height={16} borderRadius={4} style={{ marginBottom: 14 }} />
        <div className="market-product-card-footer" style={{ marginTop: 'auto', paddingTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '50%' }}>
            <SkeletonBox width="90%" height={16} borderRadius={4} />
            <SkeletonBox width="70%" height={13} borderRadius={4} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SkeletonBox width={36} height={36} borderRadius={8} />
            <SkeletonBox width={85} height={36} borderRadius={8} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function SkeletonMarketplaceGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="v26-cards-grid" aria-busy="true" aria-label="Đang tải danh sách bài đăng...">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonMarketplaceCard key={idx} />
      ))}
    </div>
  );
}
