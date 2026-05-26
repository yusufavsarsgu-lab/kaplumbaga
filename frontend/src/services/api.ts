function getLocalApiUrl(): string {
  if (import.meta.env.PROD) return '';

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

const rawApiUrl = import.meta.env.VITE_API_URL || getLocalApiUrl();

export const API_URL = rawApiUrl.replace(/\/$/, '');

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    throw data;
  }

  return data;
}
