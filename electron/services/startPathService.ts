import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';
import os from 'os';

let cachedStartPath: string | null = null;

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  const configDir = path.join(userDataPath, 'config');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return path.join(configDir, 'startPath.json');
}

export function loadStartPath(): string | null {
  if (cachedStartPath !== null) {
    return cachedStartPath;
  }

  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.startPath && fs.existsSync(config.startPath)) {
        cachedStartPath = config.startPath;
        return cachedStartPath;
      }
    }
  } catch (error) {
    console.error('Error loading start path:', error);
  }

  return null;
}

export function saveStartPath(startPath: string): void {
  try {
    const configPath = getConfigPath();
    const config = { startPath };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    cachedStartPath = startPath;
  } catch (error) {
    console.error('Error saving start path:', error);
    throw error;
  }
}

export async function selectStartPath(isFirstTime: boolean = false): Promise<string | null> {
  try {
    // 처음 실행 시 안내 메시지 표시
    if (isFirstTime) {
      await dialog.showMessageBox({
        type: 'info',
        title: '시작 경로 설정',
        message: '시작경로를 지정하세요!',
        detail: '앱이 시작될 폴더를 선택해주세요.',
        buttons: ['확인'],
      });
    }

    const result = await dialog.showOpenDialog({
      title: '시작 경로 선택',
      message: isFirstTime ? '시작경로를 지정하세요!' : '앱이 시작될 폴더를 선택하세요',
      properties: ['openDirectory'],
      defaultPath: os.homedir(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    saveStartPath(selectedPath);
    return selectedPath;
  } catch (error) {
    console.error('Error selecting start path:', error);
    return null;
  }
}

export function getStartPathOrHome(): string {
  const startPath = loadStartPath();
  if (startPath) {
    return startPath;
  }
  return os.homedir();
}

export function deleteStartPath(): void {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    cachedStartPath = null;
  } catch (error) {
    console.error('Error deleting start path:', error);
    throw error;
  }
}

