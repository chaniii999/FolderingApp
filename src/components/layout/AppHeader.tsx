import { BackIcon } from '../icons/BackIcon';
import { ForwardIcon } from '../icons/ForwardIcon';
import { getHotkeys } from '../../config/hotkeys';
import type { FileContentViewerRef } from '../FileContentViewer';

interface AppHeaderProps {
  isExplorerVisible: boolean;
  onToggleExplorer: () => void;
  selectedFileName: string | null;
  selectedFilePath: string | null;
  fileViewerState: { isEditing: boolean; hasChanges: boolean };
  fileContentViewerRef: React.RefObject<FileContentViewerRef>;
}

export default function AppHeader({
  isExplorerVisible,
  onToggleExplorer,
  selectedFileName,
  selectedFilePath,
  fileViewerState,
  fileContentViewerRef,
}: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-6 py-2">
        <button
          onClick={onToggleExplorer}
          className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
          title={`${isExplorerVisible ? '디렉토리 탭 닫기' : '디렉토리 탭 열기'} (${getHotkeys().toggleExplorer})`}
        >
          {isExplorerVisible ? <BackIcon /> : <ForwardIcon />}
        </button>
        <div className="flex items-center gap-2 flex-1">
          {selectedFileName && (
            <span className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
              {selectedFileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedFilePath && !fileViewerState.isEditing && (
            <>
              <button
                onClick={() => fileContentViewerRef.current?.handleEdit()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`편집 (${getHotkeys().edit})`}
              >
                Edit
              </button>
              <button
                onClick={() => fileContentViewerRef.current?.handleDelete()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title="삭제"
              >
                Del
              </button>
            </>
          )}
          {selectedFilePath && fileViewerState.isEditing && (
            <>
              {fileViewerState.hasChanges && (
                <span className="text-xs text-orange-600 dark:text-orange-400">변경됨</span>
              )}
              <button
                onClick={() => fileContentViewerRef.current?.handleSave()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`저장 (${getHotkeys().save})`}
              >
                저장
              </button>
              <button
                onClick={() => fileContentViewerRef.current?.handleCancel()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`취소 (${getHotkeys().cancel})`}
              >
                취소
              </button>
              <button
                onClick={() => fileContentViewerRef.current?.handleDelete()}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title="삭제"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

