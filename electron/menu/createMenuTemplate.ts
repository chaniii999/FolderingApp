import { app, BrowserWindow } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

interface TextEditorConfig {
  horizontalPadding: number;
  fontSize: number;
}

interface CreateMenuTemplateOptions {
  loadTextEditorConfig: () => TextEditorConfig;
  mainWindow: Electron.BrowserWindow | null;
}

/**
 * 메뉴 템플릿을 생성하는 함수
 */
export function createMenuTemplate({
  loadTextEditorConfig,
  mainWindow,
}: CreateMenuTemplateOptions): MenuItemConstructorOptions[] {
  const config = loadTextEditorConfig();
  
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Select Path',
          click: () => {
            console.log('[Menu] Select Path clicked');
            const window = BrowserWindow.getAllWindows()[0];
            console.log('[Menu] Window found:', window ? 'yes' : 'no', window && !window.isDestroyed() ? 'not destroyed' : 'destroyed or null');
            if (window && !window.isDestroyed()) {
              console.log('[Menu] Sending menu:selectPath event');
              window.webContents.send('menu:selectPath');
            } else {
              console.error('[Menu] Cannot send menu:selectPath - window is null or destroyed');
            }
          },
        },
        {
          label: 'Open Folder',
          click: () => {
            const window = BrowserWindow.getAllWindows()[0];
            if (window && !window.isDestroyed()) {
              window.webContents.send('menu:openFolder');
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
            console.log('[Menu] Toggle Hide Non Text Files clicked, checked:', menuItem.checked);
            const window = BrowserWindow.getAllWindows()[0];
            console.log('[Menu] Window found:', window ? 'yes' : 'no', window && !window.isDestroyed() ? 'not destroyed' : 'destroyed or null');
            if (window && !window.isDestroyed()) {
              console.log('[Menu] Sending menu:toggleHideNonTextFiles event');
              window.webContents.send('menu:toggleHideNonTextFiles', menuItem.checked);
            } else {
              console.error('[Menu] Cannot send menu:toggleHideNonTextFiles - window is null or destroyed');
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
            console.log('[Menu] Theme Light clicked');
            const window = BrowserWindow.getAllWindows()[0];
            if (window && !window.isDestroyed()) {
              console.log('[Menu] Sending menu:changeTheme event: light');
              window.webContents.send('menu:changeTheme', 'light');
            } else {
              console.error('[Menu] Cannot send menu:changeTheme - window is null or destroyed');
            }
          },
        },
        {
          label: 'Dark',
          type: 'radio',
          id: 'theme-dark',
          checked: false,
          click: () => {
            console.log('[Menu] Theme Dark clicked');
            const window = BrowserWindow.getAllWindows()[0];
            if (window && !window.isDestroyed()) {
              console.log('[Menu] Sending menu:changeTheme event: dark');
              window.webContents.send('menu:changeTheme', 'dark');
            } else {
              console.error('[Menu] Cannot send menu:changeTheme - window is null or destroyed');
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
            const paddingOptions = [40, 60, 80, 100, 120, 140, 160, 180, 200, 240, 280, 320];
            return paddingOptions.map((padding) => ({
              label: `${padding}px`,
              type: 'radio' as const,
              id: `padding-${padding}`,
              checked: config.horizontalPadding === padding,
              click: () => {
                console.log('[Menu] Change Horizontal Padding clicked:', padding);
                const window = BrowserWindow.getAllWindows()[0];
                if (window && !window.isDestroyed()) {
                  console.log('[Menu] Sending menu:changeHorizontalPadding event:', padding);
                  window.webContents.send('menu:changeHorizontalPadding', padding);
                } else {
                  console.error('[Menu] Cannot send menu:changeHorizontalPadding - window is null or destroyed');
                }
              },
            }));
          })(),
        },
        { type: 'separator' },
        {
          label: '폰트 크기 (Ctrl+Plus/Minus)',
          submenu: (() => {
            const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
            return fontSizeOptions.map((fontSize) => ({
              label: `${fontSize}px`,
              type: 'radio' as const,
              id: `fontsize-${fontSize}`,
              checked: config.fontSize === fontSize,
              click: () => {
                console.log('[Menu] Change Font Size clicked:', fontSize);
                const window = BrowserWindow.getAllWindows()[0];
                if (window && !window.isDestroyed()) {
                  console.log('[Menu] Sending menu:changeFontSize event:', fontSize);
                  window.webContents.send('menu:changeFontSize', fontSize);
                } else {
                  console.error('[Menu] Cannot send menu:changeFontSize - window is null or destroyed');
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
            const window = BrowserWindow.getAllWindows()[0];
            if (window && !window.isDestroyed()) {
              window.webContents.send('menu:toggleShowHelp', menuItem.checked);
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

  return template;
}

