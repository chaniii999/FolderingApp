import { contextBridge, ipcRenderer } from 'electron';

export interface Folder {
  id: string;
  name: string;
  created_at: string;
}

export interface Note {
  id: string;
  folder_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const api = {
  // Folder CRUD
  folder: {
    list: (): Promise<Folder[]> => ipcRenderer.invoke('folder:list'),
    create: (name: string): Promise<Folder> => ipcRenderer.invoke('folder:create', name),
    update: (id: string, name: string): Promise<Folder> => ipcRenderer.invoke('folder:update', id, name),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('folder:delete', id),
  },
  // Note CRUD
  note: {
    list: (folderId: string): Promise<Note[]> => ipcRenderer.invoke('note:list', folderId),
    get: (id: string): Promise<Note> => ipcRenderer.invoke('note:get', id),
    create: (folderId: string, title: string, content: string): Promise<Note> =>
      ipcRenderer.invoke('note:create', folderId, title, content),
    update: (id: string, title: string, content: string): Promise<Note> =>
      ipcRenderer.invoke('note:update', id, title, content),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('note:delete', id),
  },
  // File System
  filesystem: {
    getCurrentDirectory: (): Promise<string> => ipcRenderer.invoke('filesystem:getCurrentDirectory'),
    listDirectory: (dirPath: string): Promise<FileSystemItem[]> => ipcRenderer.invoke('filesystem:listDirectory', dirPath),
    changeDirectory: (currentPath: string, targetName: string): Promise<string | null> =>
      ipcRenderer.invoke('filesystem:changeDirectory', currentPath, targetName),
    getParentDirectory: (dirPath: string): Promise<string | null> =>
      ipcRenderer.invoke('filesystem:getParentDirectory', dirPath),
    getHomeDirectory: (): Promise<string> => ipcRenderer.invoke('filesystem:getHomeDirectory'),
    readFile: (filePath: string): Promise<string | null> => ipcRenderer.invoke('filesystem:readFile', filePath),
    writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('filesystem:writeFile', filePath, content),
    createFile: (filePath: string, content?: string): Promise<void> => ipcRenderer.invoke('filesystem:createFile', filePath, content),
    createDirectory: (dirPath: string): Promise<void> => ipcRenderer.invoke('filesystem:createDirectory', dirPath),
    renameFile: (oldPath: string, newName: string): Promise<void> => ipcRenderer.invoke('filesystem:renameFile', oldPath, newName),
    deleteFile: (filePath: string): Promise<void> => ipcRenderer.invoke('filesystem:deleteFile', filePath),
    deleteDirectory: (dirPath: string): Promise<void> => ipcRenderer.invoke('filesystem:deleteDirectory', dirPath),
    selectStartPath: (): Promise<string | null> => ipcRenderer.invoke('filesystem:selectStartPath'),
    saveStartPath: (startPath: string): Promise<void> => ipcRenderer.invoke('filesystem:saveStartPath', startPath),
    openFolder: (folderPath: string): Promise<void> => ipcRenderer.invoke('filesystem:openFolder', folderPath),
  },
  menu: {
    updateCheckbox: (id: string, checked: boolean): Promise<void> => ipcRenderer.invoke('menu:updateCheckbox', id, checked),
  },
};

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

// 메뉴 이벤트 리스너
ipcRenderer.on('menu:toggleHideNonTextFiles', (_event, checked: boolean) => {
  // DOM이 로드된 후 이벤트 전달
  const customEvent = new CustomEvent('menu:toggleHideNonTextFiles', { detail: checked });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.dispatchEvent(customEvent);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.dispatchEvent(customEvent);
    });
  }
});

ipcRenderer.on('menu:toggleShowHelp', (_event, checked: boolean) => {
  // DOM이 로드된 후 이벤트 전달
  const customEvent = new CustomEvent('menu:toggleShowHelp', { detail: checked });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.dispatchEvent(customEvent);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.dispatchEvent(customEvent);
    });
  }
});

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: typeof api;
  }
}

