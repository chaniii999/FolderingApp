import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export function getCurrentDirectory(): string {
  return process.cwd();
}

export function listDirectory(dirPath: string): FileSystemItem[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    return items
      .map((item) => {
        const fullPath = path.join(dirPath, item.name);
        const stats = fs.statSync(fullPath);
        
        return {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size: item.isFile() ? stats.size : undefined,
        };
      })
      .sort((a, b) => {
        // 디렉토리를 먼저, 그 다음 이름순 정렬
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error('Error listing directory:', error);
    throw error;
  }
}

export function changeDirectory(currentPath: string, targetName: string): string | null {
  try {
    const targetPath = path.join(currentPath, targetName);
    
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return null;
    }

    return targetPath;
  } catch (error) {
    console.error('Error changing directory:', error);
    return null;
  }
}

export function getParentDirectory(dirPath: string): string | null {
  try {
    const parent = path.dirname(dirPath);
    
    // 루트 디렉토리인 경우 null 반환
    if (parent === dirPath) {
      return null;
    }
    
    return parent;
  } catch (error) {
    console.error('Error getting parent directory:', error);
    return null;
  }
}

