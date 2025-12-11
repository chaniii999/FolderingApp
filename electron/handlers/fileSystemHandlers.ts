import { IpcMain, shell } from 'electron';
import * as fileSystemService from '../services/fileSystemService';
import { saveStartPath, selectStartPath } from '../services/startPathService';
import os from 'os';
import { app } from 'electron';

export function fileSystemHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('filesystem:getCurrentDirectory', async () => {
    try {
      return fileSystemService.getCurrentDirectory();
    } catch (error) {
      console.error('Error getting current directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:listDirectory', async (_event, dirPath: string) => {
    try {
      return fileSystemService.listDirectory(dirPath);
    } catch (error) {
      console.error('Error listing directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:changeDirectory', async (_event, currentPath: string, targetName: string) => {
    try {
      return fileSystemService.changeDirectory(currentPath, targetName);
    } catch (error) {
      console.error('Error changing directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:getParentDirectory', async (_event, dirPath: string) => {
    try {
      return fileSystemService.getParentDirectory(dirPath);
    } catch (error) {
      console.error('Error getting parent directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:getHomeDirectory', async () => {
    try {
      return os.homedir();
    } catch (error) {
      console.error('Error getting home directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:readFile', async (_event, filePath: string) => {
    try {
      return fileSystemService.readFile(filePath);
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:writeFile', async (_event, filePath: string, content: string) => {
    try {
      fileSystemService.writeFile(filePath, content);
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:createFile', async (_event, filePath: string, content: string = '') => {
    try {
      fileSystemService.createFile(filePath, content);
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:createDirectory', async (_event, dirPath: string) => {
    try {
      fileSystemService.createDirectory(dirPath);
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:renameFile', async (_event, oldPath: string, newName: string) => {
    try {
      fileSystemService.renameFile(oldPath, newName);
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:deleteFile', async (_event, filePath: string) => {
    try {
      fileSystemService.deleteFile(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:deleteDirectory', async (_event, dirPath: string) => {
    try {
      fileSystemService.deleteDirectory(dirPath);
    } catch (error) {
      console.error('Error deleting directory:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:selectStartPath', async () => {
    try {
      const selectedPath = await selectStartPath(false); // 사용자가 버튼으로 호출하는 경우이므로 false
      return selectedPath;
    } catch (error) {
      console.error('Error selecting start path:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:saveStartPath', async (_event, startPath: string) => {
    try {
      saveStartPath(startPath);
    } catch (error) {
      console.error('Error saving start path:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:openFolder', async (_event, folderPath: string) => {
    try {
      await shell.openPath(folderPath);
    } catch (error) {
      console.error('Error opening folder:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:copyFile', async (_event, sourcePath: string, destPath: string) => {
    try {
      fileSystemService.copyFile(sourcePath, destPath);
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:moveFile', async (_event, sourcePath: string, destPath: string) => {
    try {
      fileSystemService.moveFile(sourcePath, destPath);
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:searchFiles', async (_event, dirPath: string, query: string, recursive: boolean) => {
    try {
      return fileSystemService.searchFiles(dirPath, query, recursive);
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:createGuideFile', async (_event, dirPath: string) => {
    try {
      return fileSystemService.createGuideFile(dirPath);
    } catch (error) {
      console.error('Error creating guide file:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:getUserDataPath', async () => {
    try {
      return app.getPath('userData');
    } catch (error) {
      console.error('Error getting user data path:', error);
      throw error;
    }
  });
}

