/**
 * API Helper — Resolves relative API paths to absolute paths for Electron client compatibility.
 */

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  
  if (typeof window !== 'undefined') {
    // If running under 'file:' scheme (Electron production) or desktop context, use production Vercel backend.
    if (window.location.protocol === 'file:' || window.desktopWindow?.isDesktop) {
      return `${configuredBaseUrl || 'https://mianshizhu.xyz'}${cleanPath}`;
    }
  }
  
  return cleanPath;
}
