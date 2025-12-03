import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHotkeys, isHotkey } from '../config/hotkeys';

interface FileContentViewerProps {
  filePath: string | null;
  onSelectPreviousFile?: () => void;
  onSelectNextFile?: () => void;
  onDeselectFile?: () => void;
}

function FileContentViewer({ filePath, onSelectPreviousFile, onSelectNextFile, onDeselectFile }: FileContentViewerProps) {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [dialogSelectedOption, setDialogSelectedOption] = useState<'save' | 'cancel'>('save');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isMarkdownFile = (path: string | null): boolean => {
    if (!path) return false;
    const extension = path.toLowerCase().split('.').pop();
    return extension === 'md' || extension === 'markdown';
  };

  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        setContent('');
        setOriginalContent('');
        setError(null);
        setIsEditing(false);
        setHasChanges(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setIsEditing(false);
        setHasChanges(false);

        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        if (typeof window.api.filesystem.readFile !== 'function') {
          throw new Error('readFile 함수를 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
        }

        const fileContent = await window.api.filesystem.readFile(filePath);
        
        if (fileContent === null) {
          throw new Error('파일을 읽을 수 없습니다.');
        }

        setContent(fileContent);
        setOriginalContent(fileContent);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.';
        setError(errorMessage);
        setContent('');
        setOriginalContent('');
        console.error('Error loading file:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    // 파일이 선택되었을 때 FileContentViewer에 포커스를 주어서 키 이벤트를 받을 수 있게 함
    if (filePath && !loading && !error && containerRef.current && !isEditing) {
      // 약간의 지연을 두어 FileExplorer의 포커스가 해제된 후 포커스를 받음
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [filePath, loading, error, isEditing]);

  // 전역 키 이벤트 리스너 추가 (파일이 선택되었을 때 "i" 키로 편집 모드 진입)
  useEffect(() => {
    if (!filePath || loading || error || isEditing || showSaveDialog) {
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // "i" 키로 편집 모드 진입 (파일이 선택되어 있을 때만)
      if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [filePath, loading, error, isEditing, showSaveDialog]);

  useEffect(() => {
    if (content !== originalContent) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [content, originalContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 알림창이 떴을 때는 z, x만 처리
    if (showSaveDialog) {
      e.preventDefault();
      e.stopPropagation();
      
      // z 키로 저장 옵션 선택 또는 저장 실행
      if (isHotkey(e.key, 'enter')) {
        if (dialogSelectedOption === 'save') {
          handleSaveDialogConfirm();
        } else {
          setDialogSelectedOption('save');
        }
        return;
      }
      
      // x 키로 취소 옵션 선택 또는 취소 실행
      if (isHotkey(e.key, 'goBack')) {
        if (dialogSelectedOption === 'cancel') {
          handleSaveDialogCancel();
        } else {
          setDialogSelectedOption('cancel');
        }
        return;
      }
      
      // 다른 키는 무시
      return;
    }

    if (isEditing) {
      // Ctrl+F5 저장
      if (e.ctrlKey && (e.key === 'F5' || e.key === 'f5')) {
        e.preventDefault();
        handleSave();
        return;
      }
      
      // Esc 취소
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        handleCancel();
        return;
      }
    } else {
      // 파일이 선택되어 있고 편집 모드가 아닐 때
      if (filePath && !loading && !error) {
        // 위/아래 화살표: 텍스트 스크롤
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // 기본 스크롤 동작 허용 (preventDefault 하지 않음)
          return;
        }
        
        // 왼쪽 화살표: 이전 파일 선택
        if (e.key === 'ArrowLeft' && onSelectPreviousFile) {
          e.preventDefault();
          onSelectPreviousFile();
          return;
        }
        
        // 오른쪽 화살표: 다음 파일 선택
        if (e.key === 'ArrowRight' && onSelectNextFile) {
          e.preventDefault();
          onSelectNextFile();
          return;
        }
        
        // x 키로 파일 선택 해제 (뒤로가기)
        if (isHotkey(e.key, 'goBack') && onDeselectFile) {
          e.preventDefault();
          onDeselectFile();
          return;
        }
        
        // i 키로 편집 모드 진입
        if ((e.key === 'i' || e.key === 'I')) {
          e.preventDefault();
          setIsEditing(true);
          return;
        }
      }
    }
  };

  const handleEditClick = () => {
    if (filePath && !loading && !error) {
      setIsEditing(true);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSave = async () => {
    if (!filePath || !hasChanges) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      if (typeof window.api.filesystem.writeFile !== 'function') {
        throw new Error('writeFile 함수를 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
      }

      await window.api.filesystem.writeFile(filePath, content);
      setOriginalContent(content);
      setHasChanges(false);
      setIsEditing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 저장 중 오류가 발생했습니다.';
      setError(errorMessage);
      console.error('Error saving file:', err);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowSaveDialog(true);
      setDialogSelectedOption('save');
    } else {
      setIsEditing(false);
      setContent(originalContent);
    }
  };

  const handleSaveDialogConfirm = async () => {
    await handleSave();
    setShowSaveDialog(false);
  };

  const handleSaveDialogCancel = () => {
    setContent(originalContent);
    setHasChanges(false);
    setIsEditing(false);
    setShowSaveDialog(false);
  };

  if (!filePath) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold">파일 내용</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          파일을 선택하세요
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full relative"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate" title={filePath}>
              {filePath.split(/[/\\]/).pop() || filePath}
            </h2>
            <div className="text-xs text-gray-500 mt-1 font-mono truncate" title={filePath}>
              {filePath}
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={handleEditClick}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              title={`편집 (${getHotkeys().edit})`}
            >
              편집
            </button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-xs text-orange-600">변경됨</span>
              )}
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                title={`저장 (${getHotkeys().save})`}
              >
                저장
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                title={`취소 (${getHotkeys().cancel})`}
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-white relative"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="px-4 py-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          </div>
        ) : isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            className="w-full h-full p-4 text-sm font-mono resize-none border-none outline-none"
            spellCheck={false}
          />
        ) : isMarkdownFile(filePath) ? (
          <div className="p-6 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>
      
      {showSaveDialog && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => {
            // 배경 클릭 시 다이얼로그 닫기 방지
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">저장하시겠습니까?</h3>
            <p className="text-gray-600 mb-6">
              변경사항이 저장되지 않았습니다. 저장하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveDialogCancel}
                className={`px-4 py-2 rounded flex items-center gap-2 ${
                  dialogSelectedOption === 'cancel'
                    ? 'bg-gray-400 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <span>취소</span>
                <span className="text-xs bg-gray-600 text-white px-1.5 py-0.5 rounded">
                  {getHotkeys().goBack}
                </span>
              </button>
              <button
                onClick={handleSaveDialogConfirm}
                className={`px-4 py-2 rounded flex items-center gap-2 ${
                  dialogSelectedOption === 'save'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <span>저장</span>
                <span className="text-xs bg-blue-700 text-white px-1.5 py-0.5 rounded">
                  {getHotkeys().enter}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileContentViewer;
