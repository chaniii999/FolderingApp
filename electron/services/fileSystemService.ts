import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getStartPathOrHome } from './startPathService';

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export function getCurrentDirectory(): string {
  // 저장된 시작 경로가 있으면 사용, 없으면 홈 디렉토리
  return getStartPathOrHome();
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

export function readFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return null;
    }

    // 파일 크기가 10MB를 초과하면 읽지 않음
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stats.size > maxSize) {
      throw new Error('파일이 너무 큽니다 (최대 10MB)');
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

export function writeFile(filePath: string, content: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('파일이 존재하지 않습니다.');
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      throw new Error('디렉토리는 저장할 수 없습니다.');
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
}

export function createFile(filePath: string, content: string = ''): void {
  try {
    if (fs.existsSync(filePath)) {
      throw new Error('파일이 이미 존재합니다.');
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
}

export function createDirectory(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      throw new Error('디렉토리가 이미 존재합니다.');
    }

    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
}

export function renameFile(oldPath: string, newName: string): void {
  try {
    if (!fs.existsSync(oldPath)) {
      throw new Error('파일 또는 폴더가 존재하지 않습니다.');
    }

    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    if (fs.existsSync(newPath)) {
      throw new Error('같은 이름의 파일 또는 폴더가 이미 존재합니다.');
    }

    fs.renameSync(oldPath, newPath);
  } catch (error) {
    console.error('Error renaming file:', error);
    throw error;
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('파일이 존재하지 않습니다.');
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      throw new Error('디렉토리는 deleteDirectory를 사용하세요.');
    }

    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

export function deleteDirectory(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      throw new Error('디렉토리가 존재하지 않습니다.');
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('파일은 deleteFile을 사용하세요.');
    }

    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error deleting directory:', error);
    throw error;
  }
}

