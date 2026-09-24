// Utility functions for handling diagram data

export type StorageOrigin = 'server' | 'session' | null;

/**
 * Minimal document-context for a server-backed working document.
 * Application/session context only: ID + origin (+ display name). Never part
 * of the diagram/model JSON.
 */
export interface ServerDocumentContext {
  id: string;
  storageOrigin: 'server';
  name?: string;
}

export const SERVER_CONTEXT_STORAGE_KEY = 'fossflow-last-opened-context';

export const buildServerDocumentContext = (
  id: string,
  name?: string
): ServerDocumentContext => {
  return {
    id,
    storageOrigin: 'server',
    ...(typeof name === 'string' ? { name } : {})
  };
};

/**
 * Safely restore server identity after a reload. Returns null (treat the
 * document as non-server-backed) when the stored context is malformed,
 * incomplete, not server-scoped, or does not match the last-opened document.
 */
export const readServerDocumentContext = (
  raw: string | null | undefined,
  lastOpenedId: string | null | undefined
): ServerDocumentContext | null => {
  if (!raw || !lastOpenedId) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const { id, storageOrigin, name } = parsed as Record<string, unknown>;
    if (storageOrigin !== 'server') return null;
    if (typeof id !== 'string' || id.length === 0) return null;
    if (id !== lastOpenedId) return null;
    if (name !== undefined && typeof name !== 'string') return null;

    return {
      id,
      storageOrigin: 'server',
      ...(typeof name === 'string' ? { name } : {})
    };
  } catch {
    return null;
  }
};

/**
 * A server-backed document can be updated in place via PUT /api/diagrams/:id.
 * Anything else (session/local, new, or malformed) must never trigger a
 * server PUT: unknown origin is treated as non-server by default.
 */
export const isServerBackedDiagram = (
  diagram: { id?: unknown; storageOrigin?: unknown } | null | undefined
): diagram is { id: string; storageOrigin: 'server' } => {
  return (
    !!diagram &&
    diagram.storageOrigin === 'server' &&
    typeof diagram.id === 'string' &&
    diagram.id.length > 0
  );
};

export interface DiagramData {
  title: string;
  version?: string;
  description?: string;
  labelBackgroundOpacity?: number;
  icons: any[];
  colors: any[];
  items: any[];
  views: any[];
  fitToScreen?: boolean;
}

// Deep merge two objects, with special handling for arrays
export function mergeDiagramData(base: DiagramData, update: Partial<DiagramData>): DiagramData {
  return {
    title: update.title !== undefined ? update.title : base.title,
    version: update.version !== undefined ? update.version : base.version,
    description: update.description !== undefined ? update.description : base.description,
    labelBackgroundOpacity: update.labelBackgroundOpacity !== undefined ? update.labelBackgroundOpacity : base.labelBackgroundOpacity,
    // For arrays, completely replace if provided, otherwise keep base
    icons: update.icons !== undefined ? update.icons : base.icons,
    colors: update.colors !== undefined ? update.colors : base.colors,
    items: update.items !== undefined ? update.items : base.items,
    views: update.views !== undefined ? update.views : base.views,
    fitToScreen: update.fitToScreen !== undefined ? update.fitToScreen : base.fitToScreen
  };
}

// Extract only the data that should be saved/exported
export function extractSavableData(fullData: DiagramData): DiagramData {
  return {
    title: fullData.title,
    version: fullData.version,
    description: fullData.description,
    labelBackgroundOpacity: fullData.labelBackgroundOpacity,
    // Only include non-empty arrays
    icons: fullData.icons || [],
    colors: fullData.colors || [],
    items: fullData.items || [],
    views: fullData.views || [],
    fitToScreen: fullData.fitToScreen !== false
  };
}

// Validate diagram data structure
export function validateDiagramData(data: any): data is DiagramData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray(data.icons) &&
    Array.isArray(data.colors) &&
    Array.isArray(data.items) &&
    Array.isArray(data.views)
  );
}