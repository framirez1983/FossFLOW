import type { Icon, LibraryIcon } from 'fossflow';

/**
 * HTTP client for the server-persisted Icon Library (`/api/icon-library`).
 *
 * Follows the same conventions as storageService.ServerStorage: relative
 * `/api` paths in production (nginx proxy), `localhost:3001` in development.
 * There is intentionally NO browser-local fallback store: when the server is
 * unreachable the library is reported unavailable and all library UI hides
 * or disables itself while project icons keep working.
 */
export interface LibraryAddResult {
  entry: LibraryIcon;
  duplicate: boolean;
}

const serverBaseUrl = (): string => {
  const isDevelopment =
    window.location.hostname === 'localhost' &&
    window.location.port === '3000';
  return isDevelopment ? 'http://localhost:3001' : '';
};

const readError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const text = await response.text();
    if (!text) return `${fallback} (status ${response.status})`;
    try {
      const data = JSON.parse(text) as { error?: string };
      return data.error ?? text;
    } catch {
      return text;
    }
  } catch {
    return `${fallback} (status ${response.status})`;
  }
};

export class IconLibraryService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? serverBaseUrl();
  }

  async list(): Promise<LibraryIcon[]> {
    const response = await fetch(`${this.baseUrl}/api/icon-library`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new Error(await readError(response, 'Failed to list icon library'));
    }
    return (await response.json()) as LibraryIcon[];
  }

  async add(icon: Icon): Promise<LibraryAddResult> {
    const response = await fetch(`${this.baseUrl}/api/icon-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: icon.name,
        url: icon.url,
        isIsometric: icon.isIsometric,
        scale: icon.scale
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      throw new Error(
        await readError(response, 'Failed to add icon to library')
      );
    }
    const data = (await response.json()) as {
      entry: LibraryIcon;
      duplicate: boolean;
    };
    return { entry: data.entry, duplicate: data.duplicate === true };
  }

  async rename(id: string, name: string): Promise<LibraryIcon> {
    const response = await fetch(
      `${this.baseUrl}/api/icon-library/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(10000)
      }
    );
    if (!response.ok) {
      throw new Error(
        await readError(response, 'Failed to rename library icon')
      );
    }
    const data = (await response.json()) as { entry: LibraryIcon };
    return data.entry;
  }

  async remove(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/icon-library/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      throw new Error(
        await readError(response, 'Failed to delete library icon')
      );
    }
  }
}

export const iconLibraryService = new IconLibraryService();
