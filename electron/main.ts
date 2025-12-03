import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { folderHandlers } from './handlers/folderHandlers';
import { noteHandlers } from './handlers/noteHandlers';
import { fileSystemHandlers } from './handlers/fileSystemHandlers';
import { getDevConfig } from './services/devConfigService';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function setupMenuBar(showMenuBar: boolean) {
  if (showMenuBar) {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo', label: 'Undo' },
          { role: 'redo', label: 'Redo' },
          { type: 'separator' },
          { role: 'cut', label: 'Cut' },
          { role: 'copy', label: 'Copy' },
          { role: 'paste', label: 'Paste' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload', label: 'Reload' },
          { role: 'forceReload', label: 'Force Reload' },
          { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
          { type: 'separator' },
          { role: 'resetZoom', label: 'Actual Size' },
          { role: 'zoomIn', label: 'Zoom In' },
          { role: 'zoomOut', label: 'Zoom Out' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Toggle Fullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize', label: 'Minimize' },
          { role: 'close', label: 'Close' },
        ],
      },
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about', label: 'About ' + app.getName() },
          { type: 'separator' },
          { role: 'services', label: 'Services' },
          { type: 'separator' },
          { role: 'hide', label: 'Hide ' + app.getName() },
          { role: 'hideOthers', label: 'Hide Others' },
          { role: 'unhide', label: 'Show All' },
          { type: 'separator' },
          { role: 'quit', label: 'Quit ' + app.getName() },
        ],
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    Menu.setApplicationMenu(null);
  }
}

function createWindow() {
  const devConfig = getDevConfig();
  console.log('[Main] Dev config loaded:', devConfig);
  console.log('[Main] isDev:', isDev);
  
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  console.log('[Main] devTools setting:', devConfig.devTools);
  if (devConfig.devTools) {
    console.log('[Main] Opening DevTools');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('[Main] DevTools disabled by config');
  }

  console.log('[Main] menuBar setting:', devConfig.menuBar);
  setupMenuBar(devConfig.menuBar);
}

app.whenReady().then(() => {
  // 개발자 설정 로드 확인
  const devConfig = getDevConfig();
  console.log('[Main] Initial dev config:', devConfig);
  
  // IPC 핸들러 등록
  folderHandlers(ipcMain);
  noteHandlers(ipcMain);
  fileSystemHandlers(ipcMain);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

