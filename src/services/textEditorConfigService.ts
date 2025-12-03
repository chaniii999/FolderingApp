export interface TextEditorConfig {
  horizontalPadding: number;
  fontSize: number;
}

const defaultConfig: TextEditorConfig = {
  horizontalPadding: 80,
  fontSize: 14,
};

let cachedConfig: TextEditorConfig | null = null;

async function getConfigPath(): Promise<string> {
  try {
    if (window.api?.filesystem) {
      const currentDir = await window.api.filesystem.getCurrentDirectory();
      // Windows 경로 구분자 처리
      const separator = currentDir.includes('\\') ? '\\' : '/';
      return `${currentDir}${separator}config${separator}textEditor.json`;
    }
  } catch (error) {
    console.error('Error getting config path:', error);
  }
  // 기본값: 프로젝트 루트 기준
  return 'config/textEditor.json';
}

export async function loadTextEditorConfig(): Promise<TextEditorConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (window.api?.filesystem) {
      const configPath = await getConfigPath();
      const configContent = await window.api.filesystem.readFile(configPath);
      
      if (configContent) {
        const config = JSON.parse(configContent) as Partial<TextEditorConfig>;
        cachedConfig = {
          horizontalPadding: config.horizontalPadding ?? defaultConfig.horizontalPadding,
          fontSize: config.fontSize ?? defaultConfig.fontSize,
        };
        return cachedConfig;
      }
    }
  } catch (error) {
    console.error('Error loading text editor config:', error);
  }

  // 기본값 반환
  cachedConfig = { ...defaultConfig };
  return cachedConfig;
}

export async function saveTextEditorConfig(config: TextEditorConfig): Promise<void> {
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
    console.error('Error saving text editor config:', error);
  }
}

export function getTextEditorConfig(): TextEditorConfig {
  return cachedConfig || defaultConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

