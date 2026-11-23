declare global {
    interface Window {
        __APP_CONFIG__?: {
            apiBaseUrl?: string;
        };
    }
}

export function apiUrl(path: string): string {
    const baseUrl = (window.__APP_CONFIG__?.apiBaseUrl || '').replace(/\/+$/, '');
    return `${baseUrl}${path}`;
}
