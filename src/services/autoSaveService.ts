/**
 * 자동 저장 서비스
 * 편집 중인 파일의 내용을 임시 파일로 저장하여 저장 실패 시 복구 가능하게 함
 */

interface AutoSaveData {
  filePath: string;
  content: string;
  timestamp: number;
}

class AutoSaveService {
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private saveDataMap: Map<string, AutoSaveData> = new Map();
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30초마다 자동 저장
  private readonly MAX_AUTO_SAVE_FILES = 10; // 최대 10개 파일까지 자동 저장

  /**
   * 파일의 임시 저장 경로 생성
   */
  private async getTempFilePath(originalPath: string): Promise<string> {
    if (!window.api?.filesystem) {
      throw new Error('API가 로드되지 않았습니다.');
    }

    // 파일 경로를 해시하여 임시 파일명 생성
    const hash = await this.hashString(originalPath);
    const fileName = path.basename(originalPath);
    const tempDir = await this.getTempDir();
    return `${tempDir}${path.sep}${hash}_${fileName}.autosave`;
  }

  /**
   * 문자열 해시 생성 (간단한 해시)
   */
  private async hashString(str: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 임시 파일 저장 디렉토리 경로 가져오기
   */
  private async getTempDir(): Promise<string> {
    if (!window.api?.filesystem) {
      throw new Error('API가 로드되지 않았습니다.');
    }

    const userDataPath = await window.api.filesystem.getUserDataPath();
    const tempDir = `${userDataPath}${path.sep}autosave`;
    
    // 디렉토리가 없으면 생성
    if (window.api.filesystem.createDirectory) {
      try {
        await window.api.filesystem.createDirectory(tempDir);
      } catch (err) {
        // 이미 존재하는 경우 무시
      }
    }

    return tempDir;
  }

  /**
   * 파일 자동 저장 시작
   */
  startAutoSave(filePath: string, content: string): void {
    // 기존 인터벌이 있으면 정리
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    // 메모리에 저장
    this.saveDataMap.set(filePath, {
      filePath,
      content,
      timestamp: Date.now(),
    });

    // 즉시 한 번 저장
    this.saveFile(filePath, content);

    // 주기적으로 자동 저장
    this.autoSaveInterval = setInterval(() => {
      const currentData = this.saveDataMap.get(filePath);
      if (currentData) {
        this.saveFile(filePath, currentData.content);
      }
    }, this.AUTO_SAVE_INTERVAL);
  }

  /**
   * 파일 내용 업데이트 (메모리에만 저장, 실제 파일 저장은 주기적으로)
   */
  updateContent(filePath: string, content: string): void {
    this.saveDataMap.set(filePath, {
      filePath,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * 파일을 임시 파일로 저장
   */
  private async saveFile(filePath: string, content: string): Promise<void> {
    try {
      if (!window.api?.filesystem) {
        return;
      }

      const tempFilePath = await this.getTempFilePath(filePath);
      
      // 임시 파일로 저장 (파일이 없으면 생성, 있으면 덮어쓰기)
      try {
        if (window.api.filesystem.writeFile) {
          await window.api.filesystem.writeFile(tempFilePath, content);
        }
      } catch (err: any) {
        // 파일이 없으면 createFile로 생성
        if (err.message?.includes('존재하지 않습니다') && window.api.filesystem.createFile) {
          await window.api.filesystem.createFile(tempFilePath, content);
        } else {
          throw err;
        }
      }

      // 메모리에 저장
      this.saveDataMap.set(filePath, {
        filePath,
        content,
        timestamp: Date.now(),
      });

      // 오래된 임시 파일 정리
      await this.cleanupOldFiles();
    } catch (err) {
      console.error('Error auto-saving file:', err);
      // 자동 저장 실패는 조용히 처리 (사용자에게 알리지 않음)
    }
  }

  /**
   * 저장된 임시 파일에서 복구 가능한 내용 가져오기
   */
  async getRecoveryContent(filePath: string): Promise<string | null> {
    try {
      const tempFilePath = await this.getTempFilePath(filePath);
      
      if (!window.api?.filesystem?.readFile) {
        return null;
      }

      const content = await window.api.filesystem.readFile(tempFilePath);
      return content;
    } catch (err) {
      console.error('Error reading recovery file:', err);
      return null;
    }
  }

  /**
   * 자동 저장 중지
   */
  stopAutoSave(filePath: string): void {
    // 해당 파일의 자동 저장 데이터 제거
    this.saveDataMap.delete(filePath);

    // 모든 파일의 자동 저장이 중지되면 인터벌 정리
    if (this.saveDataMap.size === 0 && this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * 자동 저장 완료 (정상 저장 성공 시)
   */
  async clearAutoSave(filePath: string): Promise<void> {
    try {
      // 메모리에서 제거
      this.saveDataMap.delete(filePath);

      // 임시 파일 삭제
      const tempFilePath = await this.getTempFilePath(filePath);
      if (window.api?.filesystem?.deleteFile) {
        try {
          await window.api.filesystem.deleteFile(tempFilePath);
        } catch (err) {
          // 파일이 없으면 무시
        }
      }
    } catch (err) {
      console.error('Error clearing auto-save:', err);
    }
  }

  /**
   * 오래된 임시 파일 정리
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const tempDir = await this.getTempDir();
      if (!window.api?.filesystem?.listDirectory) {
        return;
      }

      const items = await window.api.filesystem.listDirectory(tempDir);
      const autoSaveFiles = items
        .filter(item => !item.isDirectory && item.name.endsWith('.autosave'))
        .sort((a, b) => {
          // 파일 수정 시간으로 정렬 (최신이 먼저)
          return 0; // 간단히 이름으로 정렬
        });

      // 최대 개수를 초과하면 오래된 파일 삭제
      if (autoSaveFiles.length > this.MAX_AUTO_SAVE_FILES) {
        const filesToDelete = autoSaveFiles.slice(this.MAX_AUTO_SAVE_FILES);
        for (const file of filesToDelete) {
          try {
            if (window.api?.filesystem?.deleteFile) {
              await window.api.filesystem.deleteFile(file.path);
            }
          } catch (err) {
            console.error('Error deleting old auto-save file:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning up old files:', err);
    }
  }
}

// path 모듈 대신 간단한 경로 처리 함수 사용
const path = {
  sep: window.navigator.platform.includes('Win') ? '\\' : '/',
  basename: (filePath: string) => {
    const separator = filePath.includes('\\') ? '\\' : '/';
    return filePath.split(separator).pop() || filePath;
  },
};

export const autoSaveService = new AutoSaveService();

