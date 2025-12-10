import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { folderHandlers } from './handlers/folderHandlers';
import { noteHandlers } from './handlers/noteHandlers';
import { fileSystemHandlers } from './handlers/fileSystemHandlers';
import { getDevConfig } from './services/devConfigService';
import { loadStartPath, selectStartPath, getStartPathOrHome } from './services/startPathService';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let applicationMenu: Menu | null = null;

interface TextEditorConfig {
  horizontalPadding: number;
  fontSize: number;
}

function loadTextEditorConfig(): TextEditorConfig {
  const defaultConfig: TextEditorConfig = {
    horizontalPadding: 80,
    fontSize: 14,
  };

  try {
    const currentDir = getStartPathOrHome();
    const configPath = path.join(currentDir, 'config', 'textEditor.json');
    
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as Partial<TextEditorConfig>;
      return {
        horizontalPadding: config.horizontalPadding ?? defaultConfig.horizontalPadding,
        fontSize: config.fontSize ?? defaultConfig.fontSize,
      };
    }
  } catch (error) {
    console.error('[Main] Error loading text editor config:', error);
  }

  return defaultConfig;
}

function updateFontMenu() {
  if (!applicationMenu || !mainWindow) return;
  
  const config = loadTextEditorConfig();
  
  // 가로 여백 옵션 업데이트
  const paddingOptions = [40, 60, 80, 100, 120, 140, 160, 180, 200, 240, 280, 320];
  // 먼저 모든 항목을 false로 설정
  paddingOptions.forEach((padding) => {
    const menuItem = applicationMenu?.getMenuItemById(`padding-${padding}`);
    if (menuItem) {
      menuItem.checked = false;
    }
  });
  // 그 다음 올바른 항목만 true로 설정
  const paddingMenuItem = applicationMenu?.getMenuItemById(`padding-${config.horizontalPadding}`);
  if (paddingMenuItem) {
    paddingMenuItem.checked = true;
  }
  
  // 폰트 크기 옵션 업데이트
  const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
  // 먼저 모든 항목을 false로 설정
  fontSizeOptions.forEach((fontSize) => {
    const menuItem = applicationMenu?.getMenuItemById(`fontsize-${fontSize}`);
    if (menuItem) {
      menuItem.checked = false;
    }
  });
  // 그 다음 올바른 항목만 true로 설정
  const fontSizeMenuItem = applicationMenu?.getMenuItemById(`fontsize-${config.fontSize}`);
  if (fontSizeMenuItem) {
    fontSizeMenuItem.checked = true;
  }
}

function setupMenuBar(showMenuBar: boolean, window: BrowserWindow) {
  mainWindow = window;
  
  // 메뉴바는 항상 표시 (Option, Help 메뉴를 위해)
  if (showMenuBar !== false) {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Select Path',
            accelerator: 'p',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:selectPath');
              }
            },
          },
          {
            label: 'Open Folder',
            accelerator: 'o',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:openFolder');
              }
            },
          },
          { type: 'separator' },
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
        label: 'Option',
        submenu: [
          {
            label: '텍스트 파일만 표시',
            type: 'checkbox',
            id: 'hideNonTextFiles',
            click: (menuItem) => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:toggleHideNonTextFiles', menuItem.checked);
              }
            },
          },
        ],
      },
      {
        label: 'Theme',
        submenu: [
          {
            label: 'Light',
            type: 'radio',
            id: 'theme-light',
            checked: true,
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:changeTheme', 'light');
              }
            },
          },
          {
            label: 'Dark',
            type: 'radio',
            id: 'theme-dark',
            checked: false,
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:changeTheme', 'dark');
              }
            },
          },
        ],
      },
      {
        label: 'Font',
        id: 'font-menu',
        submenu: [
          {
            label: '가로 여백',
            submenu: (() => {
              const config = loadTextEditorConfig();
              const paddingOptions = [40, 60, 80, 100, 120, 140, 160, 180, 200, 240, 280, 320];
              return paddingOptions.map((padding) => ({
                label: `${padding}px`,
                type: 'radio' as const,
                id: `padding-${padding}`,
                checked: config.horizontalPadding === padding,
                click: () => {
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:changeHorizontalPadding', padding);
                  }
                },
              }));
            })(),
          },
          { type: 'separator' },
          {
            label: '폰트 크기 (Ctrl+Plus/Minus)',
            submenu: (() => {
              const config = loadTextEditorConfig();
              const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
              return fontSizeOptions.map((fontSize) => ({
                label: `${fontSize}px`,
                type: 'radio' as const,
                id: `fontsize-${fontSize}`,
                checked: config.fontSize === fontSize,
                click: () => {
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:changeFontSize', fontSize);
                  }
                },
              }));
            })(),
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: '도움말',
            type: 'checkbox',
            id: 'showHelp',
            click: (menuItem) => {
              if (mainWindow) {
                mainWindow.webContents.send('menu:toggleShowHelp', menuItem.checked);
              }
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

    applicationMenu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(applicationMenu);
    
    // 메뉴바 업데이트를 위한 IPC 핸들러
    ipcMain.handle('menu:updateCheckbox', (_event, id: string, checked: boolean) => {
      const menuItem = applicationMenu?.getMenuItemById(id);
      if (menuItem) {
        menuItem.checked = checked;
      }
    });
    
    // Font 메뉴 업데이트 IPC 핸들러
    ipcMain.handle('menu:updateFontMenu', () => {
      updateFontMenu();
      return true;
    });
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
    backgroundColor: '#1f2937', // 다크 테마 기본 배경색 (gray-800)
    autoHideMenuBar: false, // Windows에서 메뉴바 항상 표시
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
  setupMenuBar(devConfig.menuBar, mainWindow);
  
  // 테마 변경 IPC 핸들러
  ipcMain.on('theme:change', (_event, theme: string) => {
    if (theme === 'dark') {
      nativeTheme.themeSource = 'dark';
      if (mainWindow) {
        mainWindow.setBackgroundColor('#1f2937'); // gray-800
      }
    } else {
      nativeTheme.themeSource = 'light';
      if (mainWindow) {
        mainWindow.setBackgroundColor('#ffffff'); // white
      }
    }
  });
  
  return mainWindow;
}

app.whenReady().then(async () => {
  // 개발자 설정 로드 확인
  const devConfig = getDevConfig();
  console.log('[Main] Initial dev config:', devConfig);
  
  // 시작 경로 확인 및 선택
  const startPath = loadStartPath();
  if (!startPath) {
    console.log('[Main] No start path found, showing dialog...');
    const selectedPath = await selectStartPath(true); // 처음 실행이므로 true 전달
    if (!selectedPath) {
      console.log('[Main] No path selected, using home directory');
    } else {
      console.log('[Main] Start path selected:', selectedPath);
      // 처음 시작 경로 설정 시 가이드.md 생성
      try {
        const { createGuideFile } = await import('./services/fileSystemService');
        const guidePath = createGuideFile(selectedPath);
        if (guidePath) {
          console.log('[Main] Guide file created:', guidePath);
        }
      } catch (error) {
        console.error('[Main] Error creating guide file:', error);
      }
    }
  } else {
    console.log('[Main] Using saved start path:', startPath);
  }
  
  // IPC 핸들러 등록
  folderHandlers(ipcMain);
  noteHandlers(ipcMain);
  fileSystemHandlers(ipcMain);

  const window = createWindow();
  mainWindow = window;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow();
      mainWindow = window;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

