import React from 'react';

export function StickerLoader({
  message = 'Đang tìm kiếm & tải đồ dùng học tập...',
  subtext = 'Edu Share+ • Chia sẻ đồ dùng học tập an toàn',
  compact = false,
}: {
  message?: string;
  subtext?: string;
  compact?: boolean;
}) {
  return (
    <div className={`sticker-loader-container${compact ? ' compact' : ''}`} role="status" aria-live="polite">
      <div className="sticker-mascot-wrap">
        {/* Animated Sticker SVG Mascot */}
        <svg
          className="sticker-mascot-svg"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bookCoverGrad" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="bookPageGrad" x1="30" y1="30" x2="130" y2="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <linearGradient id="sparkleGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id="stickerShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#1e3a8a" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Sparkle 1 */}
          <path
            className="sticker-sparkle s1"
            d="M 28 36 Q 34 36 34 30 Q 34 36 40 36 Q 34 36 34 42 Q 34 36 28 36 Z"
            fill="url(#sparkleGrad)"
          />
          {/* Sparkle 2 */}
          <path
            className="sticker-sparkle s2"
            d="M 125 40 Q 131 40 131 34 Q 131 40 137 40 Q 131 40 131 46 Q 131 40 125 40 Z"
            fill="url(#sparkleGrad)"
          />
          {/* Sparkle 3 */}
          <path
            className="sticker-sparkle s3"
            d="M 118 120 Q 123 120 123 115 Q 123 120 128 120 Q 123 120 123 125 Q 123 120 118 120 Z"
            fill="url(#sparkleGrad)"
          />

          {/* Book Shadow & Body */}
          <g filter="url(#stickerShadow)" className="sticker-main-body">
            {/* White Sticker Outline border */}
            <rect x="26" y="30" width="108" height="96" rx="18" fill="#ffffff" stroke="#e2e8f0" strokeWidth="4" />

            {/* Back Book Cover */}
            <rect x="30" y="34" width="100" height="88" rx="14" fill="url(#bookCoverGrad)" />

            {/* Inside Book Pages */}
            <rect x="36" y="38" width="88" height="80" rx="10" fill="url(#bookPageGrad)" />

            {/* Bookmark ribbon */}
            <path d="M 75 38 L 75 70 L 80 65 L 85 70 L 85 38 Z" fill="#ef4444" />

            {/* Bookmark cute heart */}
            <circle cx="80" cy="50" r="2.5" fill="#ffffff" />

            {/* Mascot Eyes */}
            <g className="sticker-eyes">
              {/* Left Eye */}
              <circle cx="62" cy="74" r="5" fill="#0f172a" />
              <circle cx="63.5" cy="72.5" r="1.8" fill="#ffffff" />
              {/* Right Eye (winking or open with shine) */}
              <circle cx="98" cy="74" r="5" fill="#0f172a" />
              <circle cx="99.5" cy="72.5" r="1.8" fill="#ffffff" />
            </g>

            {/* Rosy Cheeks */}
            <ellipse cx="54" cy="82" rx="4.5" ry="3" fill="#fda4af" opacity="0.85" />
            <ellipse cx="106" cy="82" rx="4.5" ry="3" fill="#fda4af" opacity="0.85" />

            {/* Happy Smile Mouth */}
            <path
              d="M 73 80 Q 80 89 87 80"
              stroke="#0f172a"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* Graduation Cap / Bookmark Star on top */}
            <g className="sticker-cap">
              <path d="M 80 18 L 102 27 L 80 34 L 58 27 Z" fill="#1e293b" />
              <polygon points="102,27 106,38 98,38" fill="#f59e0b" />
            </g>

            {/* Waving Hand */}
            <g className="sticker-waving-hand">
              <ellipse cx="132" cy="68" rx="8" ry="6" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="134" cy="65" r="2" fill="#eab308" />
            </g>
          </g>
        </svg>
      </div>

      <div className="sticker-loader-text-wrap">
        <h3 className="sticker-loader-title">{message}</h3>
        {subtext ? <p className="sticker-loader-subtext">{subtext}</p> : null}
      </div>

      {/* Modern Wave Pulse Dots */}
      <div className="sticker-pulse-track" aria-hidden="true">
        <span className="sticker-dot d1" />
        <span className="sticker-dot d2" />
        <span className="sticker-dot d3" />
        <span className="sticker-dot d4" />
      </div>
    </div>
  );
}
