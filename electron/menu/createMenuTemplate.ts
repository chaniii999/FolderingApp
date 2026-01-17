import { app, BrowserWindow } from 'electron';
import type { MenuItem, MenuItemConstructorOptions } from 'electron';

interface TextEditorConfig {
  horizontalPadding: number;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
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

  function getAvailableWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        return window;
      }
    }
    return null;
  }

  function sendMenuEvent(channel: string, ...args: unknown[]) {
    const window = getAvailableWindow();
    if (!window) return;
    window.webContents.send(channel, ...args);
  }

  function handleSelectPathClick() {
    sendMenuEvent('menu:selectPath');
  }

  function handleOpenFolderClick() {
    sendMenuEvent('menu:openFolder');
  }

  function handleToggleHideNonTextFiles(menuItem: MenuItem) {
    sendMenuEvent('menu:toggleHideNonTextFiles', menuItem.checked);
  }

  function handleLightThemeClick() {
    sendMenuEvent('menu:changeTheme', 'light');
  }

  function handleDarkThemeClick() {
    sendMenuEvent('menu:changeTheme', 'dark');
  }

  function handleChangeHorizontalPadding(padding: number) {
    sendMenuEvent('menu:changeHorizontalPadding', padding);
  }

  function handleChangeFontSize(fontSize: number) {
    sendMenuEvent('menu:changeFontSize', fontSize);
  }

  function handleChangeTextAlign(align: TextEditorConfig['textAlign']) {
    sendMenuEvent('menu:changeTextAlign', align);
  }

  function handleToggleShowHelp(menuItem: MenuItem) {
    sendMenuEvent('menu:toggleShowHelp', menuItem.checked);
  }
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Select Path',
          id: 'selectPath',
          enabled: true,
          click: handleSelectPathClick,
        },
        {
          label: 'Open Folder',
          click: handleOpenFolderClick,
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
          click: handleToggleHideNonTextFiles,
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
          click: handleLightThemeClick,
        },
        {
          label: 'Dark',
          type: 'radio',
          id: 'theme-dark',
          checked: false,
          click: handleDarkThemeClick,
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
              click: handleChangeHorizontalPadding.bind(null, padding),
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
              click: handleChangeFontSize.bind(null, fontSize),
            }));
          })(),
        },
        { type: 'separator' },
        {
          label: '텍스트 정렬',
          submenu: [
            {
              label: '좌측 정렬',
              type: 'radio' as const,
              id: 'textalign-left',
              checked: config.textAlign === 'left',
              click: handleChangeTextAlign.bind(null, 'left'),
            },
            {
              label: '가운데 정렬',
              type: 'radio' as const,
              id: 'textalign-center',
              checked: config.textAlign === 'center',
              click: handleChangeTextAlign.bind(null, 'center'),
            },
            {
              label: '우측 정렬',
              type: 'radio' as const,
              id: 'textalign-right',
              checked: config.textAlign === 'right',
              click: handleChangeTextAlign.bind(null, 'right'),
            },
          ],
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
          click: handleToggleShowHelp,
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

