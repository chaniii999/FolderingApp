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
  },
};

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: typeof api;
  }
}

