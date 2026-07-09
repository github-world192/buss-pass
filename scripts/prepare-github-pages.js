#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '';
  }

  const trimmed = basePath.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

const basePath = normalizeBasePath(
  process.env.GITHUB_PAGES_BASE_PATH || process.env.EXPO_PUBLIC_BASE_PATH
);

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Run the web build first.');
  process.exit(1);
}

console.log(`🌐 Preparing GitHub Pages build${basePath ? ` for ${basePath}` : ''}...\n`);

function prefixRootAssetUrls(content) {
  if (!basePath) {
    return content;
  }

  return content
    .replace(/(href|src|content)=("|')\/(?!\/)/g, `$1=$2${basePath}/`)
    .replace(/url\((["']?)\/(?!\/)/g, `url($1${basePath}/`);
}

function prefixRootStringLiterals(content) {
  if (!basePath) {
    return content;
  }

  return content.replace(/([("'`])\/(?!\/)/g, `$1${basePath}/`);
}

const htmlFiles = fs.readdirSync(distDir).filter((filename) => filename.endsWith('.html'));

for (const filename of htmlFiles) {
  const filePath = path.join(distDir, filename);
  const updated = prefixRootAssetUrls(fs.readFileSync(filePath, 'utf8'));
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`✅ Rebased HTML asset URLs in ${filename}`);
}

const manifestPath = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.start_url = basePath ? `${basePath}/` : '/';
  manifest.scope = basePath ? `${basePath}/` : '/';
  manifest.icons = (manifest.icons || []).map((icon) => ({
    ...icon,
    src: icon.src?.startsWith('/') && basePath ? `${basePath}${icon.src}` : icon.src,
  }));

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('✅ Updated manifest.json');
}

const serviceWorkerPath = path.join(distDir, 'service-worker.js');
if (fs.existsSync(serviceWorkerPath)) {
  const updated = prefixRootStringLiterals(fs.readFileSync(serviceWorkerPath, 'utf8'));
  fs.writeFileSync(serviceWorkerPath, updated, 'utf8');
  console.log('✅ Updated service-worker.js');
}

for (const filename of htmlFiles) {
  if (!filename.endsWith('.html') || filename === 'index.html' || filename === '404.html' || filename.startsWith('_') || filename.startsWith('+')) {
    continue;
  }

  const routeName = filename.slice(0, -'.html'.length);
  const sourcePath = path.join(distDir, filename);
  const routeDir = path.join(distDir, routeName);

  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(sourcePath, path.join(routeDir, 'index.html'));
  fs.unlinkSync(sourcePath);
  console.log(`✅ Converted ${filename} to ${routeName}/index.html`);
}

const notFoundSource = path.join(
  distDir,
  fs.existsSync(path.join(distDir, '+not-found.html')) ? '+not-found.html' : 'index.html'
);
fs.copyFileSync(notFoundSource, path.join(distDir, '404.html'));
console.log('✅ Created 404.html');

fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
console.log('✅ Created .nojekyll');

console.log('\n🎉 GitHub Pages build is ready!');
