import { useState } from 'react';
import { usePwaInstall } from './usePwaInstall';

export function PwaInstallBanner() {
  const { canInstall, isIOS, installApp, dismiss } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!canInstall) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide((prev) => !prev);
      return;
    }

    setInstalling(true);
    try {
      await installApp();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <aside
      className="pwa-install-banner"
      role="region"
      aria-label="Cài đặt ứng dụng di động"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '480px',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        padding: '14px 18px',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
        zIndex: 9999,
        display: 'grid',
        gap: '10px',
        animation: 'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/icons/icon.svg"
            alt="Edu Share+ App Icon"
            width={40}
            height={40}
            style={{ borderRadius: '10px', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)' }}
          />
          <div>
            <strong style={{ fontSize: '14px', display: 'block', color: '#f8fafc' }}>
              Cài đặt App EDU SHARE+
            </strong>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Mở nhanh 1-chạm, giao diện toàn màn hình mượt mà
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            disabled={installing}
            style={{
              background: 'linear-gradient(135deg, #ee4d2d 0%, #ff6b4a 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(238, 77, 45, 0.4)',
            }}
          >
            {installing ? 'Đang mở…' : isIOS ? '📲 Hướng dẫn' : '📲 Cài đặt'}
          </button>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Đóng thông báo"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#e2e8f0',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px', color: '#38bdf8' }}>
            🍎 Cách cài trên iPhone (Safari):
          </div>
          1. Bấm vào nút <strong>Chia sẻ (biểu tượng mũi tên lên ⎋)</strong> ở thanh dưới Safari.<br />
          2. Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính" (Add to Home Screen ⊞)</strong>.<br />
          3. Bấm <strong>"Thêm" (Add)</strong> ở góc trên bên phải.
        </div>
      )}

      <style>{`
        @keyframes slideUpBanner {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </aside>
  );
}
