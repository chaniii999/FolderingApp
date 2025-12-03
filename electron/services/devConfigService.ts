import fs from 'fs';
import path from 'path';

export interface DevConfig {
  devTools: boolean;
  menuBar: boolean;
}

const defaultConfig: DevConfig = {
  devTools: false,
  menuBar: false,
};

let cachedConfig: DevConfig | null = null;

function getConfigPath(): string {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'config', 'dev.json');
  console.log('[DevConfig] Config path:', configPath);
  console.log('[DevConfig] Current working directory:', cwd);
  console.log('[DevConfig] File exists:', fs.existsSync(configPath));
  return configPath;
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

