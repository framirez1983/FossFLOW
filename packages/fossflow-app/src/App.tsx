import { useState, useEffect, useRef } from 'react';
import { Isoflow } from 'fossflow';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import { useTranslation } from 'react-i18next';
import {
  DiagramData,
  StorageOrigin,
  SERVER_CONTEXT_STORAGE_KEY,
  buildServerDocumentContext,
  readServerDocumentContext,
  isServerBackedDiagram,
  mergeDiagramData,
  extractSavableData
} from './diagramUtils';
import { StorageManager } from './StorageManager';
import { DiagramManager } from './components/DiagramManager';
import { storageManager } from './services/storageService';
import ChangeLanguage from './components/ChangeLanguage';
import { allLocales } from 'fossflow';
import { useIconPackManager, IconPackName } from './services/iconPackManager';
import './App.css';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

// Load core isoflow icons (always loaded)
const coreIcons = flattenCollections([isoflowIsopack]);

interface SavedDiagram {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
  // Where this document came from. 'server' documents retain their server ID
  // and can be updated in place; everything else saves to session/local.
  // Absent (older saves) means non-server.
  storageOrigin?: StorageOrigin;
}

function App() {
  // Get base path from PUBLIC_URL, ensure no trailing slash for React Router
  const publicUrl = process.env.PUBLIC_URL || '';
  // React Router basename should not have trailing slash
  const basename = publicUrl ? (publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl) : '/';

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/display/:readonlyDiagramId" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function EditorPage() {
  // Initialize icon pack manager with core icons
  const iconPackManager = useIconPackManager(coreIcons);
  const { readonlyDiagramId } = useParams<{ readonlyDiagramId: string }>();

  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [isDiagramsInitialized, setIsDiagramsInitialized] = useState<boolean>(false);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(
    null
  );
  const [diagramName, setDiagramName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [fossflowKey, setFossflowKey] = useState(0); // Key to force re-render of FossFLOW
  const [currentModel, setCurrentModel] = useState<DiagramData | null>(null); // Store current model state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [serverStorageAvailable, setServerStorageAvailable] = useState(false);
  const isReadonlyUrl =
    window.location.pathname.startsWith('/display/') && readonlyDiagramId;

  // Initialize with empty diagram data
  // Create default colors for connectors
  const defaultColors = [
    { id: 'blue', value: '#0066cc' },
    { id: 'green', value: '#00aa00' },
    { id: 'red', value: '#cc0000' },
    { id: 'orange', value: '#ff9900' },
    { id: 'purple', value: '#9900cc' },
    { id: 'black', value: '#000000' },
    { id: 'gray', value: '#666666' }
  ];

  const [diagramData, setDiagramData] = useState<DiagramData>(() => {
    // Initialize with last opened data if available
    const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');
    if (lastOpenedData) {
      try {
        const data = JSON.parse(lastOpenedData);
        const importedIcons = (data.icons || []).filter((icon: any) => {
          return icon.collection === 'imported';
        });
        const mergedIcons = [...coreIcons, ...importedIcons];
        return {
          ...data,
          icons: mergedIcons,
          colors: data.colors?.length ? data.colors : defaultColors,
          fitToScreen: data.fitToScreen !== false
        };
      } catch (e) {
        console.error('Failed to load last opened data:', e);
      }
    }

    // Default state if no saved data
    return {
      title: 'Untitled Diagram',
      icons: coreIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
  });

  // Check for server storage availability
  useEffect(() => {
    storageManager
      .initialize()
      .then(() => {
        setServerStorageAvailable(storageManager.isServerStorage());
      })
      .catch(console.error);
  }, []);

  // Check if readonlyDiagramId exists - if exists, load diagram in view-only mode
  useEffect(() => {
    if (!isReadonlyUrl || !serverStorageAvailable) return;
    const loadReadonlyDiagram = async () => {
      try {
        const storage = storageManager.getStorage();
        // Get diagram metadata
        const diagramList = await storage.listDiagrams();
        const diagramInfo = diagramList.find((d) => {
          return d.id === readonlyDiagramId;
        });
        // Load the diagram data from server storage
        const data = await storage.loadDiagram(readonlyDiagramId);
        // Convert to SavedDiagram interface format
        const readonlyDiagram: SavedDiagram = {
          id: readonlyDiagramId,
          name: diagramInfo?.name || data.title || 'Readonly Diagram',
          data: data,
          createdAt: new Date().toISOString(),
          updatedAt:
            diagramInfo?.lastModified.toISOString() || new Date().toISOString()
        };
        await loadDiagram(readonlyDiagram, true);
      } catch (error) {
        // Alert if unable to load readonly diagram and redirect to new diagram
        alert(t('dialog.readOnly.failed'));
        window.location.href = '/';
      }
    };
    loadReadonlyDiagram();
  }, [readonlyDiagramId, serverStorageAvailable]);

  // Update diagramData when loaded icons change
  useEffect(() => {
    setDiagramData((prev) => {
      return {
        ...prev,
        icons: [
          ...iconPackManager.loadedIcons,
          ...(prev.icons || []).filter((icon) => {
            return icon.collection === 'imported';
          })
        ]
      };
    });
  }, [iconPackManager.loadedIcons]);

  // Load diagrams from localStorage on component mount
  useEffect(() => {
    const savedDiagrams = localStorage.getItem('fossflow-diagrams');
    if (savedDiagrams) {
      setDiagrams(JSON.parse(savedDiagrams));
      setIsDiagramsInitialized(true);
    }

    // Load last opened diagram metadata (data is already loaded in state initialization)
    const lastOpenedId = localStorage.getItem('fossflow-last-opened');

    let restoredFromSessionList = false;
    if (lastOpenedId && savedDiagrams) {
      try {
        const allDiagrams = JSON.parse(savedDiagrams);
        const lastDiagram = allDiagrams.find((d: SavedDiagram) => {
          return d.id === lastOpenedId;
        });
        if (lastDiagram) {
          setCurrentDiagram(lastDiagram);
          setDiagramName(lastDiagram.name);
          // Also set currentModel to match diagramData
          setCurrentModel(diagramData);
          restoredFromSessionList = true;
        }
      } catch (e) {
        console.error('Failed to restore last diagram metadata:', e);
      }
    }

    if (!restoredFromSessionList) {
      // No session entry claimed the last-opened document: it may be a
      // server-backed document restored from the working-document cache.
      // Only an explicit, well-formed server context matching the last-opened
      // ID restores server identity; anything else stays non-server-backed.
      const serverContext = readServerDocumentContext(
        localStorage.getItem(SERVER_CONTEXT_STORAGE_KEY),
        lastOpenedId
      );
      if (serverContext) {
        const restoredName =
          serverContext.name || diagramData.title || 'Loaded Diagram';
        setCurrentDiagram({
          id: serverContext.id,
          name: restoredName,
          data: diagramData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storageOrigin: 'server'
        });
        setDiagramName(restoredName);
        setCurrentModel(diagramData);
      } else {
        localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);
      }
    }
  }, []);

  // Save diagrams to localStorage whenever they change
  useEffect(() => {
    if (!isDiagramsInitialized) return;

    try {
      // Store diagrams without the full icon data
      const diagramsToStore = diagrams.map((d) => {
        return {
          ...d,
          data: {
            ...d.data,
            icons: [] // Don't store icons with each diagram
          }
        };
      });
      localStorage.setItem(
        'fossflow-diagrams',
        JSON.stringify(diagramsToStore)
      );
    } catch (e) {
      console.error('Failed to save diagrams:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert(t('alert.quotaExceeded'));
      }
    }
  }, [diagrams]);

  const saveDiagram = () => {
    if (!diagramName.trim()) {
      alert(t('alert.enterDiagramName'));
      return;
    }

    // Check if a diagram with this name already exists (excluding current)
    const existingDiagram = diagrams.find((d) => {
      return d.name === diagramName.trim() && d.id !== currentDiagram?.id;
    });

    if (existingDiagram) {
      const confirmOverwrite = window.confirm(
        t('alert.diagramExists', { name: diagramName })
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    // Construct save data - include only imported icons
    const importedIcons = (
      currentModel?.icons ||
      diagramData.icons ||
      []
    ).filter((icon) => {
      return icon.collection === 'imported';
    });

    const savedData = {
      title: diagramName,
      icons: importedIcons, // Save only imported icons with diagram
      colors: currentModel?.colors || diagramData.colors || [],
      items: currentModel?.items || diagramData.items || [],
      views: currentModel?.views || diagramData.views || [],
      labelBackgroundOpacity:
        currentModel?.labelBackgroundOpacity ??
        diagramData.labelBackgroundOpacity,
      fitToScreen: true
    };

    const newDiagram: SavedDiagram = {
      id: currentDiagram?.id || Date.now().toString(),
      name: diagramName,
      data: savedData,
      createdAt: currentDiagram?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageOrigin: 'session'
    };

    if (currentDiagram) {
      // Update existing diagram
      setDiagrams(
        diagrams.map((d) => {
          return d.id === currentDiagram.id ? newDiagram : d;
        })
      );
    } else if (existingDiagram) {
      // Replace existing diagram with same name
      setDiagrams(
        diagrams.map((d) => {
          return d.id === existingDiagram.id
            ? {
                ...newDiagram,
                id: existingDiagram.id,
                createdAt: existingDiagram.createdAt
              }
            : d;
        })
      );
      newDiagram.id = existingDiagram.id;
      newDiagram.createdAt = existingDiagram.createdAt;
    } else {
      // Add new diagram
      setDiagrams([...diagrams, newDiagram]);
    }

    setCurrentDiagram(newDiagram);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);
    setLastAutoSave(new Date());

    // The working document is now session-backed, even if it started life as
    // a server document: drop any persisted server identity.
    localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);

    // Save as last opened
    try {
      localStorage.setItem('fossflow-last-opened', newDiagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(newDiagram.data)
      );
    } catch (e) {
      console.error('Failed to save diagram:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert(t('alert.storageFull'));
        setShowStorageManager(true);
      }
    }
  };

  /**
   * Unified top-level Save.
   * - Server-backed document (loaded from Server Storage): overwrite that
   *   same server diagram via the existing PUT endpoint. Never invents an ID.
   * - Anything else: preserve the existing session/local save workflow.
   */
  const saveToServerStorage = async (): Promise<boolean> => {
    if (!isServerBackedDiagram(currentDiagram)) return false;

    try {
      const storage = storageManager.getStorage();
      if (!storageManager.isServerStorage()) {
        throw new Error(t('alert.serverStorageUnavailable'));
      }

      const dataToSave = {
        ...(currentModel || diagramData),
        name: currentDiagram.name
      };
      await storage.saveDiagram(currentDiagram.id, dataToSave);

      setCurrentDiagram({
        ...currentDiagram,
        updatedAt: new Date().toISOString()
      });
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      console.error('Failed to save diagram to server storage:', err);
      alert(t('alert.serverSaveFailed'));
      return false;
    }
  };

  const handleUnifiedSave = async () => {
    if (isServerBackedDiagram(currentDiagram)) {
      // Server document: save back to the same server diagram when dirty.
      if (hasUnsavedChanges) {
        await saveToServerStorage();
      }
      return;
    }

    // Session/local/new document: unchanged legacy behavior.
    if (currentDiagram && hasUnsavedChanges) {
      saveDiagram();
    } else {
      setShowSaveDialog(true);
    }
  };

  const loadDiagram = async (
    diagram: SavedDiagram,
    skipUnsavedCheck = false
  ) => {
    if (
      !skipUnsavedCheck &&
      hasUnsavedChanges &&
      !window.confirm(t('alert.unsavedChanges'))
    ) {
      return;
    }

    // Auto-detect and load required icon packs
    await iconPackManager.loadPacksForDiagram(diagram.data.items || []);

    // Merge imported icons with loaded icon set
    const importedIcons = (diagram.data.icons || []).filter((icon: any) => {
      return icon.collection === 'imported';
    });
    const mergedIcons = [...iconPackManager.loadedIcons, ...importedIcons];
    const dataWithIcons = {
      ...diagram.data,
      icons: mergedIcons
    };

    // Session Load dialog lists localStorage diagrams only: always mark the
    // loaded document as session-backed, regardless of any stored flag, so a
    // crafted entry can never route a server PUT.
    setCurrentDiagram({ ...diagram, storageOrigin: 'session' });
    // A session/local load supersedes any previously persisted server
    // identity for the working document.
    localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);
    setDiagramName(diagram.name);
    setDiagramData(dataWithIcons);
    setCurrentModel(dataWithIcons);
    setFossflowKey((prev) => {
      return prev + 1;
    }); // Force re-render of FossFLOW
    setShowLoadDialog(false);
    setHasUnsavedChanges(false);

    // Save as last opened (without icons)
    try {
      localStorage.setItem('fossflow-last-opened', diagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(diagram.data)
      );
    } catch (e) {
      console.error('Failed to save last opened:', e);
    }
  };

  const deleteDiagram = (id: string) => {
    if (window.confirm(t('alert.confirmDelete'))) {
      setDiagrams(
        diagrams.filter((d) => {
          return d.id !== id;
        })
      );
      if (currentDiagram?.id === id) {
        setCurrentDiagram(null);
        setDiagramName('');
        localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);
      }
    }
  };

  const newDiagram = () => {
    const message = hasUnsavedChanges
      ? t('alert.unsavedChangesExport')
      : t('alert.createNewDiagram');

    if (window.confirm(message)) {
      const emptyDiagram: DiagramData = {
        title: 'Untitled Diagram',
        icons: iconPackManager.loadedIcons, // Use currently loaded icons
        colors: defaultColors,
        items: [],
        views: [],
        fitToScreen: true
      };
      setCurrentDiagram(null);
      setDiagramName('');
      setDiagramData(emptyDiagram);
      setCurrentModel(emptyDiagram); // Reset current model too
      setFossflowKey((prev) => {
        return prev + 1;
      }); // Force re-render of FossFLOW
      setHasUnsavedChanges(false);

      // Clear last opened
      localStorage.removeItem('fossflow-last-opened');
      localStorage.removeItem('fossflow-last-opened-data');
      localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);
    }
  };

  const handleModelUpdated = (model: any) => {
    // Store the current model state whenever it updates
    // The model from Isoflow contains the COMPLETE state including all icons

    // Simply store the complete model as-is since it has everything
    const updatedModel = {
      title: model.title || diagramName || 'Untitled',
      icons: model.icons || [], // This already includes ALL icons (default + imported)
      colors: model.colors || defaultColors,
      items: model.items || [],
      views: model.views || [],
      labelBackgroundOpacity: model.labelBackgroundOpacity,
      fitToScreen: true
    };

    setCurrentModel(updatedModel);
    setDiagramData(updatedModel);

    if (!isReadonlyUrl) {
      setHasUnsavedChanges(true);
    }
  };

  const exportDiagram = () => {
    // Use the most recent model data - prefer currentModel as it gets updated by handleModelUpdated
    const modelToExport = currentModel || diagramData;

    // Get ALL icons from the current model (which includes both default and imported)
    const allModelIcons = modelToExport.icons || [];

    // For safety, also check diagramData for any imported icons not in currentModel
    const diagramImportedIcons = (diagramData.icons || []).filter((icon) => {
      return icon.collection === 'imported';
    });

    // Create a map to deduplicate icons by ID, preferring the ones from currentModel
    const iconMap = new Map();

    // First add all icons from the model (includes defaults + imported)
    allModelIcons.forEach((icon) => {
      iconMap.set(icon.id, icon);
    });

    // Then add any imported icons from diagramData that might be missing
    diagramImportedIcons.forEach((icon) => {
      if (!iconMap.has(icon.id)) {
        iconMap.set(icon.id, icon);
      }
    });

    // Get all unique icons
    const allIcons = Array.from(iconMap.values());

    const exportData = {
      title: diagramName || modelToExport.title || 'Exported Diagram',
      icons: allIcons, // Include ALL icons (default + imported) for portability
      colors: modelToExport.colors || [],
      items: modelToExport.items || [],
      views: modelToExport.views || [],
      fitToScreen: true
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName || 'diagram'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportDialog(false);
    setHasUnsavedChanges(false); // Mark as saved after export
  };

  const handleDiagramManagerLoad = async (id: string, data: any) => {
    console.log(`App: handleDiagramManagerLoad called for diagram ${id}`);

    /**
     * Icon Persistence Strategy:
     *
     * NEW BEHAVIOR (after this fix):
     * - Server storage saves ALL icons (default collections + imported custom icons)
     * - When loading, if we detect default collection icons, use ALL icons from server
     * - This preserves imported custom icons without data loss
     *
     * BACKWARD COMPATIBILITY (for old saves):
     * - Old format only saved imported icons (collection='imported')
     * - If no default icons detected, merge imported icons with current defaults
     * - This ensures old diagrams still load correctly
     *
     * DETECTION:
     * - Check if loaded icons contain any default collection (isoflow, aws, gcp, etc.)
     * - If yes: New format, use all icons from server
     * - If no: Old format, merge imported with defaults
     */
    const loadedIcons = data.icons || [];
    console.log(`App: Server sent ${loadedIcons.length} icons`);

    // Auto-detect and load required icon packs
    await iconPackManager.loadPacksForDiagram(data.items || []);

    // Strategy: Check if server has ALL icons (both default and imported)
    // Server storage now saves ALL icons, so we should use them directly
    // For backward compatibility with old saves, we detect and merge

    let finalIcons;
    const hasDefaultIcons = loadedIcons.some((icon: any) => {
      return (
        icon.collection === 'isoflow' ||
        icon.collection === 'aws' ||
        icon.collection === 'gcp'
      );
    });

    if (hasDefaultIcons) {
      // New format: Server saved ALL icons (default + imported)
      // Use them directly to preserve any custom icon modifications
      console.log(
        `App: Using all ${loadedIcons.length} icons from server (includes defaults + imported)`
      );
      finalIcons = loadedIcons;
    } else {
      // Old format: Server only saved imported icons
      // Merge imported icons with currently loaded icon packs
      const importedIcons = loadedIcons.filter((icon: any) => {
        return icon.collection === 'imported';
      });
      finalIcons = [...iconPackManager.loadedIcons, ...importedIcons];
      console.log(
        `App: Old format detected. Merged ${importedIcons.length} imported icons with ${iconPackManager.loadedIcons.length} defaults = ${finalIcons.length} total`
      );
    }

    const mergedData: DiagramData = {
      ...data,
      title: data.title || data.name || 'Loaded Diagram',
      icons: finalIcons,
      colors: data.colors?.length ? data.colors : defaultColors,
      fitToScreen: data.fitToScreen !== false
    };

    const newDiagram = {
      id,
      name: data.name || 'Loaded Diagram',
      data: mergedData,
      createdAt: data.created || new Date().toISOString(),
      updatedAt: data.lastModified || new Date().toISOString(),
      // Retain the server ID only when actually loaded from Server Storage,
      // so Save updates the same server diagram. Session loads stay local.
      storageOrigin: (storageManager.isServerStorage()
        ? 'server'
        : 'session') as StorageOrigin
    };

    console.log(`App: Setting all state for diagram ${id}`);

    // Use a single batch of state updates to minimize re-render issues
    // Update diagram data and increment key in the same render cycle
    setDiagramName(newDiagram.name);
    setCurrentDiagram(newDiagram);
    setCurrentModel(mergedData);
    setHasUnsavedChanges(false);

    // Update diagramData and key together
    // This ensures Isoflow gets the correct data with the new key
    setDiagramData(mergedData);
    setFossflowKey((prev) => {
      const newKey = prev + 1;
      console.log(`App: Updated fossflowKey from ${prev} to ${newKey}`);
      return newKey;
    });

    console.log(
      `App: Finished loading diagram ${id}, final icon count: ${finalIcons.length}`
    );

    // Persist working-document context for reload restore. Server-backed
    // documents remember their server ID (separate from the diagram/model
    // JSON); session loads clear any previously persisted server identity.
    try {
      localStorage.setItem('fossflow-last-opened', id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(mergedData)
      );
      if (newDiagram.storageOrigin === 'server') {
        localStorage.setItem(
          SERVER_CONTEXT_STORAGE_KEY,
          JSON.stringify(buildServerDocumentContext(id, newDiagram.name))
        );
      } else {
        localStorage.removeItem(SERVER_CONTEXT_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to persist last opened diagram context:', e);
    }
  };

  // i18n
  const { t, i18n } = useTranslation('app');
  
  // Get locale with fallback to en-US if not found
  const currentLocale = allLocales[i18n.language as keyof typeof allLocales] || allLocales['en-US'];

  // Auto-save functionality
  useEffect(() => {
    if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

    const autoSaveTimer = setTimeout(() => {
      // Include imported icons in auto-save
      const importedIcons = (
        currentModel?.icons ||
        diagramData.icons ||
        []
      ).filter((icon) => {
        return icon.collection === 'imported';
      });

      const savedData = {
        title: diagramName || currentDiagram.name,
        icons: importedIcons, // Save imported icons in auto-save
        colors: currentModel.colors || [],
        items: currentModel.items || [],
        views: currentModel.views || [],
        labelBackgroundOpacity: currentModel.labelBackgroundOpacity,
        fitToScreen: true
      };

      const updatedDiagram: SavedDiagram = {
        ...currentDiagram,
        data: savedData,
        updatedAt: new Date().toISOString()
      };

      setDiagrams((prevDiagrams) => {
        return prevDiagrams.map((d) => {
          return d.id === currentDiagram.id ? updatedDiagram : d;
        });
      });

      // Update last opened data
      try {
        localStorage.setItem(
          'fossflow-last-opened-data',
          JSON.stringify(savedData)
        );
        setLastAutoSave(new Date());
        setHasUnsavedChanges(false);
      } catch (e) {
        console.error('Auto-save failed:', e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          alert(t('alert.autoSaveFailed'));
          setShowStorageManager(true);
        }
      }
    }, 5000); // Auto-save after 5 seconds of changes

    return () => {
      return clearTimeout(autoSaveTimer);
    };
  }, [currentModel, hasUnsavedChanges, currentDiagram, diagramName]);

  // Warn before closing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = t('alert.beforeUnload');
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      return window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S for Save (unified: server-backed or session)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleUnifiedSave();
      }

      // Ctrl+O or Cmd+O for Open/Load
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setShowLoadDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      return window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentDiagram, hasUnsavedChanges, currentModel, diagramData]);

  return (
    <div className="App">
      <div className="toolbar">
        {!isReadonlyUrl && (
          <>
            <button onClick={newDiagram}>{t('nav.newDiagram')}</button>
            {serverStorageAvailable && (
              <button
                onClick={() => {
                  return setShowDiagramManager(true);
                }}
                style={{ backgroundColor: '#2196F3', color: 'white' }}
              >
                🌐 {t('nav.serverStorage')}
              </button>
            )}
            <button
              onClick={() => {
                return setShowSaveDialog(true);
              }}
            >
              {t('nav.saveSessionOnly')}
            </button>
            <button
              onClick={() => {
                return setShowLoadDialog(true);
              }}
            >
              {t('nav.loadSessionOnly')}
            </button>
            <button
              onClick={() => {
                return setShowExportDialog(true);
              }}
              style={{ backgroundColor: '#007bff' }}
            >
              💾 {t('nav.exportFile')}
            </button>
            <button
              onClick={() => {
                handleUnifiedSave();
              }}
              disabled={!currentDiagram || !hasUnsavedChanges}
              style={{
                backgroundColor:
                  currentDiagram && hasUnsavedChanges ? '#ffc107' : '#6c757d',
                opacity: currentDiagram && hasUnsavedChanges ? 1 : 0.5,
                cursor:
                  currentDiagram && hasUnsavedChanges
                    ? 'pointer'
                    : 'not-allowed'
              }}
              title={
                isServerBackedDiagram(currentDiagram)
                  ? t('nav.saveServerTitle')
                  : 'Save to current session only'
              }
            >
              {isServerBackedDiagram(currentDiagram)
                ? t('nav.saveServer')
                : t('nav.quickSaveSession')}
            </button>
          </>
        )}
        {isReadonlyUrl && (
          <div
            style={{
              color: 'black',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 'bold',
              border: '2px solid #000000'
            }}
          >
            {t('dialog.readOnly.mode')}
          </div>
        )}
        <ChangeLanguage />
        <span className="current-diagram">
          {isReadonlyUrl ? (
            <span>
              {t('status.current')}: {diagramName}
            </span>
          ) : (
            <>
              {currentDiagram
                ? `${t('status.current')}: ${currentDiagram.name}`
                : diagramName || t('status.untitled')}
              {hasUnsavedChanges && (
                <span style={{ color: '#ff9800', marginLeft: '10px' }}>
                  • {t('status.modified')}
                </span>
              )}
              <span
                style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}
              >
                (
                {isServerBackedDiagram(currentDiagram)
                  ? t('status.serverStorageNote')
                  : t('status.sessionStorageNote')}
                )
              </span>
            </>
          )}
        </span>
      </div>

      <div className="fossflow-container">
        <Isoflow
          key={`${fossflowKey}-${i18n.language}`}
          initialData={diagramData}
          onModelUpdated={handleModelUpdated}
          editorMode={isReadonlyUrl ? 'EXPLORABLE_READONLY' : 'EDITABLE'}
          locale={currentLocale}
          iconPackManager={{
            lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
            onToggleLazyLoading: iconPackManager.toggleLazyLoading,
            packInfo: Object.values(iconPackManager.packInfo),
            enabledPacks: iconPackManager.enabledPacks,
            onTogglePack: (packName: string, enabled: boolean) => {
              iconPackManager.togglePack(packName as any, enabled);
            }
          }}
        />
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.save.title')}</h2>
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeeba',
                padding: '15px',
                borderRadius: '4px',
                marginBottom: '20px'
              }}
            >
              <strong>⚠️ {t('dialog.save.warningTitle')}:</strong>{' '}
              {t('dialog.save.warningMessage')}
              <br />
              <span
                dangerouslySetInnerHTML={{
                  __html: t('dialog.save.warningExport')
                }}
              />
            </div>
            <input
              type="text"
              placeholder={t('dialog.save.placeholder')}
              value={diagramName}
              onChange={(e) => {
                return setDiagramName(e.target.value);
              }}
              onKeyDown={(e) => {
                return e.key === 'Enter' && saveDiagram();
              }}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={saveDiagram}>{t('dialog.save.btnSave')}</button>
              <button
                onClick={() => {
                  return setShowSaveDialog(false);
                }}
              >
                {t('dialog.save.btnCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.load.title')}</h2>
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeeba',
                padding: '15px',
                borderRadius: '4px',
                marginBottom: '20px'
              }}
            >
              <strong>⚠️ {t('dialog.load.noteTitle')}:</strong>{' '}
              {t('dialog.load.noteMessage')}
            </div>
            <div className="diagram-list">
              {diagrams.length === 0 ? (
                <p>{t('dialog.load.noSavedDiagrams')}</p>
              ) : (
                diagrams.map((diagram) => {
                  return (
                    <div key={diagram.id} className="diagram-item">
                      <div>
                        <strong>{diagram.name}</strong>
                        <br />
                        <small>
                          {t('dialog.load.updated')}:{' '}
                          {new Date(diagram.updatedAt).toLocaleString()}
                        </small>
                      </div>
                      <div className="diagram-actions">
                        <button
                          onClick={() => {
                            return loadDiagram(diagram, false);
                          }}
                        >
                          {t('dialog.load.btnLoad')}
                        </button>
                        <button
                          onClick={() => {
                            return deleteDiagram(diagram.id);
                          }}
                        >
                          {t('dialog.load.btnDelete')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="dialog-buttons">
              <button
                onClick={() => {
                  return setShowLoadDialog(false);
                }}
              >
                {t('dialog.load.btnClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.export.title')}</h2>
            <div
              style={{
                backgroundColor: '#d4edda',
                border: '1px solid #c3e6cb',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}
            >
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>✅ {t('dialog.export.recommendedTitle')}:</strong>{' '}
                {t('dialog.export.recommendedMessage')}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#155724' }}>
                {t('dialog.export.noteMessage')}
              </p>
            </div>
            <div className="dialog-buttons">
              <button onClick={exportDiagram}>
                {t('dialog.export.btnDownload')}
              </button>
              <button
                onClick={() => {
                  return setShowExportDialog(false);
                }}
              >
                {t('dialog.export.btnCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Manager */}
      {showStorageManager && (
        <StorageManager
          onClose={() => {
            return setShowStorageManager(false);
          }}
        />
      )}

      {/* Diagram Manager */}
      {showDiagramManager && (
        <DiagramManager
          onLoadDiagram={handleDiagramManagerLoad}
          currentDiagramId={currentDiagram?.id}
          currentDiagramData={currentModel || diagramData}
          onClose={() => {
            return setShowDiagramManager(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
