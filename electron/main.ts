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

import { createMenuTemplate } from './menu/createMenuTemplate';

function setupMenuBar(showMenuBar: boolean, window: BrowserWindow) {
  console.log('[Main] setupMenuBar called, showMenuBar:', showMenuBar);
  mainWindow = window;
  console.log('[Main] mainWindow set:', mainWindow ? 'yes' : 'no');
  
  // 메뉴바는 항상 표시 (Option, Help 메뉴를 위해)
  if (showMenuBar !== false) {
    console.log('[Main] Creating menu template...');
    const template = createMenuTemplate({
      loadTextEditorConfig,
      mainWindow,
    });
    console.log('[Main] Menu template created, items count:', template.length);

    applicationMenu = Menu.buildFromTemplate(template);
    console.log('[Main] Menu built from template');
    Menu.setApplicationMenu(applicationMenu);
    console.log('[Main] Application menu set');
    
    // 메뉴바 업데이트를 위한 IPC 핸들러
    ipcMain.handle('menu:updateCheckbox', (_event, id: string, checked: boolean) => {
      const menuItem = applicationMenu?.getMenuItemById(id);
      if (menuItem) {
        menuItem.checked = checked;
      }
    });
    
    // 메뉴 아이템 활성화/비활성화 IPC 핸들러
    ipcMain.handle('menu:setEnabled', (_event, id: string, enabled: boolean) => {
      const menuItem = applicationMenu?.getMenuItemById(id);
      if (menuItem) {
        menuItem.enabled = enabled;
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
      // 사용자가 취소한 경우 홈 디렉토리를 기본값으로 저장
      // 이렇게 하면 다음에 다시 대화상자가 표시되지 않음
      console.log('[Main] No path selected, using home directory as default');
      const homePath = getStartPathOrHome();
      const { saveStartPath } = await import('./services/startPathService');
      saveStartPath(homePath);
      console.log('[Main] Home directory saved as start path:', homePath);
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
  console.log('[Main] Registering IPC handlers...');
  folderHandlers(ipcMain);
  noteHandlers(ipcMain);
  fileSystemHandlers(ipcMain);
  console.log('[Main] All IPC handlers registered');

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

