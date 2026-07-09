function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath || basePath === '/') {
    return '';
  }

  const trimmed = basePath.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

export function getWebBasePath(): string {
  return normalizeBasePath(process.env.EXPO_PUBLIC_BASE_PATH);
}

export function withWebBasePath(path: string): string {
  if (!path.startsWith('/')) {
    return path;
  }

  const basePath = getWebBasePath();
  return basePath ? `${basePath}${path}` : path;
}
