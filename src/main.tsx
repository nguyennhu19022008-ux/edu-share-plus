import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { AuthSessionProvider } from './features/auth/session/AuthSessionProvider';
import './styles/legacy-base.css';
import './styles/legacy-profile-legacy.css';
import './styles/legacy-ecommerce.css';
import './styles/legacy-landing.css';
import './styles/legacy-market.css';
import './styles/legacy-student.css';
import './styles/legacy-admin.css';
import './styles/checkpoint.css';

const root = document.getElementById('root');
if (!root) throw new Error('Không tìm thấy #root.');

createRoot(root).render(
  <StrictMode>
    <AuthSessionProvider>
      <App />
    </AuthSessionProvider>
  </StrictMode>,
);

