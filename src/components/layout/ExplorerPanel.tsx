import React from 'react';
import FileExplorer, { type FileExplorerRef } from '../FileExplorer';
import Resizer from '../Resizer';
import { usePerformanceMeasure } from '../../utils/usePerformanceMeasure';

interface ExplorerPanelProps {
  fileExplorerRef: React.RefObject<FileExplorerRef>;
  currentPath: string;
  explorerWidth: number;
  showFullPath: boolean;
  error: string | null;
  selectedFilePath: string | null;
  isDialogOpen: boolean;
  hideNonTextFiles: boolean;
  isEditing: boolean;
  onPathChange: (newPath: string) => void;
  onFileSelect: (filePath: string) => void;
  onNewFileClick: () => void;
  onToggleFullPath: () => void;
  onResize: (width: number) => void;
  getCurrentFolderName: () => string;
}

function ExplorerPanel({
  fileExplorerRef,
  currentPath,
  explorerWidth,
  showFullPath,
  error,
  selectedFilePath,
  isDialogOpen,
  hideNonTextFiles,
  isEditing,
  onPathChange,
  onFileSelect,
  onNewFileClick,
  onToggleFullPath,
  onResize,
  getCurrentFolderName,
}: ExplorerPanelProps) {
  usePerformanceMeasure('ExplorerPanel');
  return (
    <>
      <div
        className="flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        style={{ width: `${explorerWidth}px`, minWidth: `${explorerWidth}px` }}
      >
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-2">
          {currentPath && (
            <span 
              className="text-sm text-gray-500 dark:text-gray-400 font-mono cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 flex-1 min-w-0 truncate"
              onClick={onToggleFullPath}
              title="클릭하여 전체 경로 표시/숨기기"
            >
              {showFullPath ? currentPath : getCurrentFolderName()}
            </span>
          )}
          <button
            onClick={onNewFileClick}
            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center flex-shrink-0"
            title="새 파일/폴더 만들기 (n)"
          >
            📁
          </button>
        </div>
        <div className="flex flex-col p-4 flex-1 overflow-hidden">
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <FileExplorer
              ref={fileExplorerRef}
              currentPath={currentPath}
              onPathChange={onPathChange}
              onFileSelect={onFileSelect}
              selectedFilePath={selectedFilePath}
              isDialogOpen={isDialogOpen}
              hideNonTextFiles={hideNonTextFiles}
              isEditing={isEditing}
            />
          </div>
        </div>
      </div>
      <Resizer
        onResize={onResize}
        minWidth={200}
        maxWidth={600}
      />
    </>
  );
}

export default React.memo(ExplorerPanel);

