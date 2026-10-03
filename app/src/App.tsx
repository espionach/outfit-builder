import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { SavedPage } from './pages/SavedPage';
import { AppDataProvider } from './state/AppData';
import { DraftProvider } from './state/Draft';
import { BackupProvider } from './state/Backup';
import { ToastProvider } from './components/Toast';

function Loading() {
  return (
    <div className="app-status" role="status">
      Loading your wardrobe…
    </div>
  );
}

function LoadFailed() {
  return (
    <div className="app-status" role="alert">
      This browser won't let the app save anything, so it can't open your wardrobe. Private browsing can do this; try a
      regular window.
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppDataProvider fallback={<Loading />} failed={<LoadFailed />}>
        <DraftProvider>
          <BackupProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<BuilderPage />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/saved/folder/:folderId" element={<SavedPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </BackupProvider>
        </DraftProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}
