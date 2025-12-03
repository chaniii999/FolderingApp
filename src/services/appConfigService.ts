export interface AppConfig {
  hideNonTextFiles: boolean;
}

const defaultConfig: AppConfig = {
  hideNonTextFiles: false,
};

let cachedConfig: AppConfig | null = null;

async function getConfigPath(): Promise<string> {
  try {
    if (window.api?.filesystem) {
      const currentDir = await window.api.filesystem.getCurrentDirectory();
      // Windows 경로 구분자 처리
      const separator = currentDir.includes('\\') ? '\\' : '/';
      return `${currentDir}${separator}config${separator}app.json`;
    }
  } catch (error) {
    console.error('Error getting config path:', error);
  }
  // 기본값: 프로젝트 루트 기준
  return 'config/app.json';
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (window.api?.filesystem) {
      const configPath = await getConfigPath();
      const configContent = await window.api.filesystem.readFile(configPath);
      
      if (configContent) {
        const config = JSON.parse(configContent) as Partial<AppConfig>;
        cachedConfig = {
          hideNonTextFiles: config.hideNonTextFiles ?? defaultConfig.hideNonTextFiles,
        };
        return cachedConfig;
      }
    }
  } catch (error) {
    console.error('Error loading app config:', error);
  }

  // 기본값 반환
  cachedConfig = { ...defaultConfig };
  return cachedConfig;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
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
    console.error('Error saving app config:', error);
  }
}

export function getAppConfig(): AppConfig {
  return cachedConfig || defaultConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

