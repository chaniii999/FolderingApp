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
  isMyMemoModeActive?: boolean;
  onPathChange: (newPath: string) => void;
  onFileSelect: (filePath: string) => void;
  onFileDeleted?: (filePath: string) => void;
  onNewFileClick: () => void;
  onMyMemoClick?: () => void;
  onTemplateManageClick?: () => void;
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
  isMyMemoModeActive = false,
  onPathChange,
  onFileSelect,
  onFileDeleted,
  onNewFileClick,
  onMyMemoClick,
  onTemplateManageClick,
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
          {onTemplateManageClick && isMyMemoModeActive && (
            <button
              onClick={onTemplateManageClick}
              className="relative w-8 h-8 text-white rounded border-2 border-gray-800 dark:border-gray-200 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-150 flex items-center justify-center flex-shrink-0 active:scale-95"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.3)',
              }}
              title="템플릿 관리"
            >
              <span className="relative z-10 text-lg">📋</span>
              <div 
                className="absolute inset-0 rounded opacity-0 hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
                }}
              />
            </button>
          )}
          {onMyMemoClick && (
            <button
              onClick={onMyMemoClick}
              className={`relative w-8 h-8 text-white rounded border-2 shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-150 flex items-center justify-center flex-shrink-0 active:scale-95 ${
                isMyMemoModeActive
                  ? 'border-yellow-400 dark:border-yellow-300 bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900'
                  : 'border-gray-800 dark:border-gray-200 bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800'
              }`}
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                boxShadow: isMyMemoModeActive
                  ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(251, 191, 36, 0.5)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.3)',
              }}
              title={isMyMemoModeActive ? '나만의 Memo (활성화됨 - 클릭하여 일반 모드로 전환)' : '나만의 Memo (클릭하여 활성화)'}
            >
              <span className="relative z-10 text-lg">📝</span>
              {isMyMemoModeActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              )}
              <div 
                className="absolute inset-0 rounded opacity-0 hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
                }}
              />
            </button>
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
              onFileDeleted={onFileDeleted}
              onNewFileClick={onNewFileClick}
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

