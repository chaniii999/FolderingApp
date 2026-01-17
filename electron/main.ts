import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
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
let isMenuHandlersRegistered = false;

interface TextEditorConfig {
  horizontalPadding: number;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
}

function loadTextEditorConfig(): TextEditorConfig {
  const defaultConfig: TextEditorConfig = {
    horizontalPadding: 80,
    fontSize: 14,
    textAlign: 'left',
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
        textAlign: config.textAlign ?? defaultConfig.textAlign,
      };
    }
  } catch (error) {
    console.error('[Main] Error loading text editor config:', error);
  }

  return defaultConfig;
}

function updateFontMenu() {
  if (!applicationMenu) return;
  
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
  
  // 텍스트 정렬 옵션 업데이트
  const textAlignOptions: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
  // 먼저 모든 항목을 false로 설정
  textAlignOptions.forEach((align) => {
    const menuItem = applicationMenu?.getMenuItemById(`textalign-${align}`);
    if (menuItem) {
      menuItem.checked = false;
    }
  });
  // 그 다음 올바른 항목만 true로 설정
  const textAlignMenuItem = applicationMenu?.getMenuItemById(`textalign-${config.textAlign}`);
  if (textAlignMenuItem) {
    textAlignMenuItem.checked = true;
  }
}

import { createMenuTemplate } from './menu/createMenuTemplate';

function handleMenuUpdateCheckbox(_event: IpcMainInvokeEvent, id: string, checked: boolean) {
  if (!applicationMenu) return false;
  const menuItem = applicationMenu.getMenuItemById(id);
  if (menuItem) {
    menuItem.checked = checked;
    return true;
  }
  return false;
}

function handleMenuSetEnabled(_event: IpcMainInvokeEvent, id: string, enabled: boolean) {
  if (!applicationMenu) return false;
  const menuItem = applicationMenu.getMenuItemById(id);
  if (menuItem) {
    menuItem.enabled = enabled;
    return true;
  }
  return false;
}

function handleMenuUpdateFontMenu() {
  updateFontMenu();
  return true;
}

function registerMenuHandlers() {
  if (isMenuHandlersRegistered) return;
  ipcMain.handle('menu:updateCheckbox', handleMenuUpdateCheckbox);
  ipcMain.handle('menu:setEnabled', handleMenuSetEnabled);
  ipcMain.handle('menu:updateFontMenu', handleMenuUpdateFontMenu);
  isMenuHandlersRegistered = true;
}

function setupMenuBar(showMenuBar: boolean, window: BrowserWindow) {
  mainWindow = window;
  
  // 메뉴바는 항상 표시 (Option, Help 메뉴를 위해)
  if (showMenuBar !== false) {
    const template = createMenuTemplate({
      loadTextEditorConfig,
      mainWindow,
    });

    applicationMenu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(applicationMenu);
    registerMenuHandlers();
  } else {
    Menu.setApplicationMenu(null);
    applicationMenu = null;
  }
}

function createWindow() {
  const devConfig = getDevConfig();
  
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

  if (devConfig.devTools) {
    mainWindow.webContents.openDevTools();
  }

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
  
  // 시작 경로 확인 및 선택
  const startPath = loadStartPath();
  if (!startPath) {
    const selectedPath = await selectStartPath(true); // 처음 실행이므로 true 전달
    if (!selectedPath) {
      // 사용자가 취소한 경우 홈 디렉토리를 기본값으로 저장
      // 이렇게 하면 다음에 다시 대화상자가 표시되지 않음
      const homePath = getStartPathOrHome();
      const { saveStartPath } = await import('./services/startPathService');
      saveStartPath(homePath);
    } else {
      // 처음 시작 경로 설정 시 가이드.md 생성
      try {
        const { createGuideFile } = await import('./services/fileSystemService');
        createGuideFile(selectedPath);
      } catch (error) {
        console.error('[Main] Error creating guide file:', error);
      }
    }
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

