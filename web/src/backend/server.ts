import { createApp } from './app';

const PORT = process.env.PORT || 4000;
const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🐾 Servidor Backend Pecuario iniciado exitosamente en http://localhost:${PORT}`);
    console.log(`📡 Rutas API disponibles en http://localhost:${PORT}/api/`);
  });
}

export default app;
