const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
const appPublicDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'public');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[sync-assets] Syncing dist to Android assets directories...');
if (fs.existsSync(distDir)) {
  copyDirRecursive(distDir, androidPublicDir);
  console.log('✓ Synced to android/app/src/main/assets/public');
  copyDirRecursive(distDir, appPublicDir);
  console.log('✓ Synced to app/src/main/assets/public');
} else {
  console.warn('⚠ dist directory not found, skipping asset sync.');
}
