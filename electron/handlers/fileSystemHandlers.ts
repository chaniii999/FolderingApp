import { IpcMain } from 'electron';
import * as fileSystemService from '../services/fileSystemService';
import os from 'os';

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
}

