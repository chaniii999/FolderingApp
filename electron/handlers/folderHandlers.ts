import { IpcMain } from 'electron';
import { initializeDatabase } from '../services/database';
import * as folderService from '../services/folderService';

export function folderHandlers(ipcMain: IpcMain): void {
  // 앱 시작 시 DB 초기화
  initializeDatabase();

  ipcMain.handle('folder:list', async () => {
    try {
      return folderService.listFolders();
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  });

  ipcMain.handle('folder:create', async (_event, name: string) => {
    try {
      return folderService.createFolder(name);
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  });

  ipcMain.handle('folder:update', async (_event, id: string, name: string) => {
    try {
      return folderService.updateFolder(id, name);
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  });

  ipcMain.handle('folder:delete', async (_event, id: string) => {
    try {
      folderService.deleteFolder(id);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  });
}

