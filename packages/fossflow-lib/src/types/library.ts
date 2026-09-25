import type { Icon } from './model';

/**
 * A server-persisted reusable icon (the Icon Library source of truth).
 * Never embedded in .fossflow documents: icons are COPIED into
 * `Model.icons` with normal project semantics on use.
 */
export interface LibraryIcon {
  id: string;
  name: string;
  url: string;
  mime?: string;
  isIsometric?: boolean;
  scale?: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Host-provided bridge between the canvas and the server Icon Library.
 * Mirrors the IconPackManagerProps pattern: the app owns server I/O, the
 * library owns presentation and copy-on-use. Library changes never dirty
 * the project or touch history.
 */
export interface LibraryManagerProps {
  icons: LibraryIcon[];
  loading: boolean;
  error: string | null;
  /** True when the server is unreachable: library UI hides/disables. */
  unavailable: boolean;
  refresh: () => Promise<void>;
  /**
   * Promote a project icon asset into the server Library.
   * Resolves with `duplicate: true` when identical bytes already exist
   * (no new entry is created).
   */
  addIcon: (icon: Icon) => Promise<{ entry: LibraryIcon; duplicate: boolean }>;
  renameIcon: (id: string, name: string) => Promise<LibraryIcon>;
  deleteIcon: (id: string) => Promise<void>;
  /** Exact-asset membership check for "Already in Library" states. */
  isInLibrary: (url: string) => boolean;
}
