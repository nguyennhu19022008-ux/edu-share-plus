import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export default class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EDU SHARE+] Route render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="checkpoint-route-error" role="alert">
          <section className="checkpoint-route-error-card">
            <h1>Không thể hiển thị trang</h1>
            <p>Đã xảy ra lỗi khi tải màn hình này. Dữ liệu local chưa bị thay đổi.</p>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
