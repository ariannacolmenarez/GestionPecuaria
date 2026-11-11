import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
// Asegurar que localStorage esté limpio de datos de prueba antiguos
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('pecuario_local_animals_v1');
    localStorage.removeItem('pecuario_local_litters_v1');
  }
} catch {
  // Ignorar errores en entornos sin soporte
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
