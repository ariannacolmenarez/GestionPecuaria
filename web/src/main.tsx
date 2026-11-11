import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
// Purga incondicional de cualquier caché local residual al arrancar
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
    (indexedDB as any).databases().then((dbs: any[]) => {
      dbs?.forEach((d) => {
        if (d.name) {
          try {
            indexedDB.deleteDatabase(d.name);
          } catch {}
        }
      });
    }).catch(() => {});
  }
} catch {
  // Ignorar errores en entornos sin soporte
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
