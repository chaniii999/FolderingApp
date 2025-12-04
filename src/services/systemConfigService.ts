import { type Theme, defaultTheme } from './themeService';

export interface SystemConfig {
  hideNonTextFiles: boolean;
  theme: Theme;
}

const defaultConfig: SystemConfig = {
  hideNonTextFiles: false,
  theme: defaultTheme,
};

let cachedConfig: SystemConfig | null = null;

async function getConfigPath(): Promise<string> {
  try {
    if (window.api?.filesystem) {
      const currentDir = await window.api.filesystem.getCurrentDirectory();
      // Windows 경로 구분자 처리
      const separator = currentDir.includes('\\') ? '\\' : '/';
      return `${currentDir}${separator}config${separator}SystemConfig.json`;
    }
  } catch (error) {
    console.error('Error getting config path:', error);
  }
  // 기본값: 프로젝트 루트 기준
  return 'config/SystemConfig.json';
}

export async function loadSystemConfig(): Promise<SystemConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (window.api?.filesystem) {
      const configPath = await getConfigPath();
      const configContent = await window.api.filesystem.readFile(configPath);
      
      if (configContent) {
        const config = JSON.parse(configContent) as Partial<SystemConfig>;
        cachedConfig = {
          hideNonTextFiles: config.hideNonTextFiles ?? defaultConfig.hideNonTextFiles,
          theme: config.theme ?? defaultConfig.theme,
        };
        return cachedConfig;
      }
      
      // 기존 app.json 파일이 있으면 마이그레이션 시도
      const oldConfigPath = configPath.replace('SystemConfig.json', 'app.json');
      try {
        const oldConfigContent = await window.api.filesystem.readFile(oldConfigPath);
        if (oldConfigContent) {
          const oldConfig = JSON.parse(oldConfigContent) as Partial<SystemConfig>;
          cachedConfig = {
            hideNonTextFiles: oldConfig.hideNonTextFiles ?? defaultConfig.hideNonTextFiles,
            theme: oldConfig.theme ?? defaultConfig.theme,
          };
          // 새 파일로 저장
          await saveSystemConfig(cachedConfig);
          return cachedConfig;
        }
      } catch (oldConfigError) {
        // 기존 파일이 없으면 무시
      }
    }
  } catch (error) {
    console.error('Error loading system config:', error);
  }

  // 기본값 반환
  cachedConfig = { ...defaultConfig };
  return cachedConfig;
}

export async function saveSystemConfig(config: SystemConfig): Promise<void> {
  try {
    if (window.api?.filesystem?.writeFile) {
      const configPath = await getConfigPath();
      await window.api.filesystem.writeFile(
        configPath,
        JSON.stringify(config, null, 2)
      );
      cachedConfig = config;
    }
  } catch (error) {
    console.error('Error saving system config:', error);
  }
}

export function getSystemConfig(): SystemConfig {
  return cachedConfig || defaultConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

