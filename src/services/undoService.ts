export type UndoActionType = 'create' | 'delete' | 'rename';

export interface UndoAction {
  type: UndoActionType;
  path: string;
  oldPath?: string; // rename의 경우
  newName?: string; // rename의 경우
  isDirectory: boolean;
  content?: string; // create의 경우
}

class UndoService {
  private history: UndoAction[][] = []; // 각 디렉토리별 히스토리
  private currentPath: string = '';

  setCurrentPath(path: string) {
    if (this.currentPath !== path) {
      this.currentPath = path;
      // 새 디렉토리로 이동하면 해당 디렉토리의 히스토리가 없으면 생성
      if (!this.history[path]) {
        this.history[path] = [];
      }
    }
  }

  addAction(action: UndoAction) {
    if (!this.history[this.currentPath]) {
      this.history[this.currentPath] = [];
    }
    this.history[this.currentPath].push(action);
  }

  getLastAction(): UndoAction | null {
    const actions = this.history[this.currentPath];
    if (!actions || actions.length === 0) {
      return null;
    }
    return actions[actions.length - 1];
  }

  popLastAction(): UndoAction | null {
    const actions = this.history[this.currentPath];
    if (!actions || actions.length === 0) {
      return null;
    }
    return actions.pop() || null;
  }

  clearHistory(path?: string) {
    if (path) {
      delete this.history[path];
    } else {
      this.history = [];
    }
  }
}

export const undoService = new UndoService();

