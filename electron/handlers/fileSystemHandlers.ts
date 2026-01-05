import { IpcMain, shell, clipboard } from 'electron';
import * as fileSystemService from '../services/fileSystemService';
import { saveStartPath, selectStartPath, deleteStartPath } from '../services/startPathService';
import { pdfService } from '../services/pdfService';
import type { PdfExportOptions } from '../services/pdfService';
import os from 'os';
import { app } from 'electron';
import fs from 'fs';

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

  ipcMain.handle('filesystem:readFileAsBase64', async (_event, filePath: string) => {
    try {
      return fileSystemService.readFileAsBase64(filePath);
    } catch (error) {
      console.error('Error reading file as base64:', error);
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

  ipcMain.handle('filesystem:deleteStartPath', async () => {
    try {
      deleteStartPath();
    } catch (error) {
      console.error('Error deleting start path:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:exportToPDF', async (
    _event,
    htmlContent: string,
    defaultFileName: string,
    options?: PdfExportOptions
  ) => {
    try {
      return await pdfService.exportHtmlToPdf(htmlContent, defaultFileName, options);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  });

  ipcMain.handle('filesystem:getClipboardFiles', async () => {
    try {
      // Windows에서는 clipboard.readBuffer를 사용하여 파일 경로를 읽을 수 있습니다
      // 하지만 더 간단한 방법은 드래그 앤 드롭 이벤트를 사용하는 것입니다
      // 클립보드에서 파일 경로를 직접 읽는 것은 플랫폼별로 다르므로
      // 빈 배열을 반환하고 드래그 앤 드롭 이벤트를 통해 처리합니다
      return [];
    } catch (error) {
      console.error('Error getting clipboard files:', error);
      return [];
    }
  });
}

