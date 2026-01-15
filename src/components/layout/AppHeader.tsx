import { memo, useCallback, useEffect, useState } from 'react';
import { BackIcon } from '../icons/BackIcon';
import { ForwardIcon } from '../icons/ForwardIcon';
import { getHotkeys } from '../../config/hotkeys';
import type { FileContentViewerRef } from '../FileContentViewer';
import { isTemplateInstanceFile, getTemplateNameFromInstance } from '../../utils/fileUtils';

interface AppHeaderProps {
  isExplorerVisible: boolean;
  onToggleExplorer: () => void;
  selectedFileName: string | null;
  selectedFilePath: string | null;
  fileViewerState: { isEditing: boolean; hasChanges: boolean };
  fileContentViewerRef: React.RefObject<FileContentViewerRef>;
}

function AppHeader({
  isExplorerVisible,
  onToggleExplorer,
  selectedFileName,
  selectedFilePath,
  fileViewerState,
  fileContentViewerRef,
}: AppHeaderProps) {
  const [isTemplateInstance, setIsTemplateInstance] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [displayFileName, setDisplayFileName] = useState<string | null>(selectedFileName);

  // 템플릿 인스턴스 확인 및 파일명 처리
  useEffect(() => {
    const checkTemplate = async (): Promise<void> => {
      if (!selectedFilePath || !selectedFileName) {
        setIsTemplateInstance(false);
        setTemplateName(null);
        setDisplayFileName(selectedFileName);
        return;
      }

      const isInstance = await isTemplateInstanceFile(selectedFilePath);
      setIsTemplateInstance(isInstance);

      if (isInstance) {
        // 확장자 제거
        const nameWithoutExt = selectedFileName.toLowerCase().endsWith('.json')
          ? selectedFileName.replace(/\.json$/i, '')
          : selectedFileName;
        setDisplayFileName(nameWithoutExt);

        // 템플릿 이름 가져오기
        const name = await getTemplateNameFromInstance(selectedFilePath);
        setTemplateName(name);
      } else {
        setDisplayFileName(selectedFileName);
        setTemplateName(null);
      }
    };

    void checkTemplate();
  }, [selectedFilePath, selectedFileName]);

  const handleEditClick = useCallback(() => {
    fileContentViewerRef.current?.handleEdit();
  }, [fileContentViewerRef]);

  const handleDeleteClick = useCallback(() => {
    fileContentViewerRef.current?.handleDelete();
  }, [fileContentViewerRef]);

  const handleSaveClick = useCallback(() => {
    fileContentViewerRef.current?.handleSave();
  }, [fileContentViewerRef]);

  const handleCancelClick = useCallback(() => {
    fileContentViewerRef.current?.handleCancel();
  }, [fileContentViewerRef]);

  const handleExportPdfClick = useCallback(() => {
    fileContentViewerRef.current?.handleExportPdf();
  }, [fileContentViewerRef]);

  const explorerToggleClassName = isExplorerVisible
    ? 'flex items-center justify-center w-8 h-8 rounded bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-200 shadow-sm'
    : 'flex items-center justify-center w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer';

  return (
    <header className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-6 py-2">
        <button
          onClick={onToggleExplorer}
          className={explorerToggleClassName}
          title={`${isExplorerVisible ? '디렉토리 탭 닫기' : '디렉토리 탭 열기'} (${getHotkeys().toggleExplorer})`}
        >
          {isExplorerVisible ? <BackIcon /> : <ForwardIcon />}
        </button>
        <div className="flex items-center gap-2 flex-1">
          {displayFileName && (
            <div className="flex items-center gap-2">
              <span className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                {displayFileName}
              </span>
              {isTemplateInstance && templateName && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({templateName})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedFilePath && !fileViewerState.isEditing && (
            <>
              <button
                onClick={handleEditClick}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`편집 (${getHotkeys().edit})`}
              >
                Edit
              </button>
              <button
                onClick={handleExportPdfClick}
                disabled={fileContentViewerRef.current?.isExportingPdf}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="PDF로 내보내기"
              >
                {fileContentViewerRef.current?.isExportingPdf ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-gray-600 dark:border-gray-300 border-t-transparent rounded-full animate-spin"></span>
                    <span>PDF</span>
                  </>
                ) : (
                  'PDF'
                )}
              </button>
              <button
                onClick={handleDeleteClick}
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
                onClick={handleSaveClick}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`저장 (${getHotkeys().save})`}
              >
                저장
              </button>
              <button
                onClick={handleCancelClick}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title={`취소 (${getHotkeys().cancel})`}
              >
                취소
              </button>
              <button
                onClick={handleDeleteClick}
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

export default memo(AppHeader);

