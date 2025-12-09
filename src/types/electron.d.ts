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

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface ElectronAPI {
  folder: {
    list: () => Promise<Folder[]>;
    create: (name: string) => Promise<Folder>;
    update: (id: string, name: string) => Promise<Folder>;
    delete: (id: string) => Promise<void>;
  };
  note: {
    list: (folderId: string) => Promise<Note[]>;
    get: (id: string) => Promise<Note>;
    create: (folderId: string, title: string, content: string) => Promise<Note>;
    update: (id: string, title: string, content: string) => Promise<Note>;
    delete: (id: string) => Promise<void>;
  };
  filesystem: {
    getCurrentDirectory: () => Promise<string>;
    listDirectory: (dirPath: string) => Promise<FileSystemItem[]>;
    changeDirectory: (currentPath: string, targetName: string) => Promise<string | null>;
    getParentDirectory: (dirPath: string) => Promise<string | null>;
    getHomeDirectory: () => Promise<string>;
    readFile: (filePath: string) => Promise<string | null>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    createFile: (filePath: string, content?: string) => Promise<void>;
    createDirectory: (dirPath: string) => Promise<void>;
    renameFile: (oldPath: string, newName: string) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    deleteDirectory: (dirPath: string) => Promise<void>;
    copyFile: (sourcePath: string, destPath: string) => Promise<void>;
    moveFile: (sourcePath: string, destPath: string) => Promise<void>;
    selectStartPath: () => Promise<string | null>;
    saveStartPath: (startPath: string) => Promise<void>;
    openFolder: (folderPath: string) => Promise<void>;
  };
  menu: {
    updateCheckbox: (id: string, checked: boolean) => Promise<void>;
    updateFontMenu: () => Promise<void>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

