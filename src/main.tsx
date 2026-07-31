import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { RealTimeSyncProvider } from './context/RealTimeSyncContext';
import { SocketProvider } from './lib/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { registerOfflineSync } from './services/offlineQueue';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

registerOfflineSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <NotificationProvider>
        <RealTimeSyncProvider>
          <SocketProvider>
            <ThemeProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ThemeProvider>
          </SocketProvider>
        </RealTimeSyncProvider>
      </NotificationProvider>
    </LanguageProvider>
  </StrictMode>
);
