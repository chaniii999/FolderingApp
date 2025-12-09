import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface DevConfig {
  devTools: boolean;
  menuBar: boolean;
}

const defaultConfig: DevConfig = {
  devTools: false,
  menuBar: true, // 프로덕션 빌드에서도 메뉴바 표시
};

let cachedConfig: DevConfig | null = null;

function getConfigPath(): string {
  // 개발 모드에서는 프로젝트 루트의 config 폴더 사용
  // 프로덕션에서는 userData 경로 사용
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    const cwd = process.cwd();
    const configPath = path.join(cwd, 'config', 'dev.json');
    console.log('[DevConfig] Dev mode - Config path:', configPath);
    return configPath;
  } else {
    // 프로덕션: userData 경로 사용 (app.whenReady() 이후에만 호출 가능)
    try {
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'config', 'dev.json');
      console.log('[DevConfig] Production - Config path:', configPath);
      return configPath;
    } catch (error) {
      // app이 준비되지 않았을 경우 fallback
      console.warn('[DevConfig] app.getPath failed, using process.cwd()');
      const cwd = process.cwd();
      return path.join(cwd, 'config', 'dev.json');
    }
  }
}

export function loadDevConfig(): DevConfig {
  if (cachedConfig) {
    console.log('[DevConfig] Using cached config:', cachedConfig);
    return cachedConfig;
  }

  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      console.log('[DevConfig] Config file exists, loading...');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent) as Partial<DevConfig>;
      
      cachedConfig = {
        devTools: config.devTools ?? defaultConfig.devTools,
        menuBar: config.menuBar ?? defaultConfig.menuBar,
      };
      console.log('[DevConfig] Loaded config:', cachedConfig);
    } else {
      console.log('[DevConfig] Config file not found, using defaults');
      cachedConfig = { ...defaultConfig };
      saveDevConfig(cachedConfig);
    }
  } catch (error) {
    console.error('[DevConfig] Error loading dev config:', error);
    cachedConfig = { ...defaultConfig };
  }

  return cachedConfig;
}

export function saveDevConfig(config: DevConfig): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    cachedConfig = config;
  } catch (error) {
    console.error('Error saving dev config:', error);
  }
}

export function getDevConfig(): DevConfig {
  return loadDevConfig();
}

export function clearCache(): void {
  cachedConfig = null;
  console.log('[DevConfig] Cache cleared');
}

