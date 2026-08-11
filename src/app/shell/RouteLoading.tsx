export default function RouteLoading() {
  return (
    <main className="checkpoint-route-loading" role="status" aria-live="polite" aria-label="Đang tải trang">
      <div className="checkpoint-route-loading-card">
        <span className="checkpoint-route-spinner" aria-hidden="true" />
        <span>Đang tải...</span>
      </div>
    </main>
  );
}
