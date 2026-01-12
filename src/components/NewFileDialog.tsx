import { useState, useEffect, useRef } from 'react';
import { joinPath } from '../utils/pathUtils';
import { getErrorMessage } from '../utils/errorHandler';
import { isMyMemoMode } from '../services/myMemoService';

export type FileType = 'folder' | 'file' | 'markdown' | 'template';

interface NewFileDialogProps {
  currentPath: string;
  onClose: () => void;
  onCreated: (filePath?: string) => void;
  onSelectTemplate?: (fileName: string) => void;
}

// 나만의 메모 모드에서만 사용 가능한 파일 타입 목록
const getFileTypes = (isMyMemoMode: boolean): { type: FileType; label: string; extension: string }[] => {
  const baseTypes: { type: FileType; label: string; extension: string }[] = [
    { type: 'folder', label: '폴더', extension: '' },
    { type: 'file', label: '파일', extension: '' },
    { type: 'markdown', label: 'Markdown 파일', extension: '.md' },
  ];
  
  if (isMyMemoMode) {
    return [...baseTypes, { type: 'template', label: '템플릿', extension: '.json' }];
  }
  
  return baseTypes;
};

function NewFileDialog({ currentPath, onClose, onCreated, onSelectTemplate }: NewFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMyMemo, setIsMyMemo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 나만의 메모 모드 확인
  useEffect(() => {
    const checkMyMemoMode = async (): Promise<void> => {
      if (currentPath) {
        const isMyMemoModeActive = await isMyMemoMode(currentPath);
        setIsMyMemo(isMyMemoModeActive);
      } else {
        setIsMyMemo(false);
      }
    };
    void checkMyMemoMode();
  }, [currentPath]);

  useEffect(() => {
    // 다이얼로그가 열리면 입력 필드에 포커스
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 다이얼로그 내부 클릭 시에도 입력 필드에 포커스 유지
  const handleDialogClick = (e: React.MouseEvent) => {
    // 버튼이나 입력 필드가 아닌 곳을 클릭했을 때만 포커스 유지
    const target = e.target as HTMLElement;
    if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT') {
      e.preventDefault();
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 모든 키 이벤트를 다이얼로그 내부에서만 처리하도록 전파 차단
    e.stopPropagation();
    
    const availableTypes = getFileTypes(isMyMemo);
    const selectedType = availableTypes[selectedTypeIndex];
    
    // Enter로 확인 처리
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 템플릿 타입이 선택된 경우 템플릿 목록 팝업 표시
      if (selectedType.type === 'template' && onSelectTemplate) {
        onSelectTemplate(fileName.trim() || '템플릿 인스턴스');
        return;
      }
      handleCreate();
      return;
    }

    // Esc로 취소 처리
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      onClose();
      return;
    }

    // 위/아래 화살표로 파일 타입 선택
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedTypeIndex((prev) => (prev > 0 ? prev - 1 : prev));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedTypeIndex((prev) => (prev < availableTypes.length - 1 ? prev + 1 : prev));
      return;
    }
  };

  useEffect(() => {
    // 다이얼로그가 열려있을 때 전역 핫키 차단
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그 내부 요소에서 발생한 이벤트는 허용
      const target = e.target as HTMLElement;
      const dialogElement = document.querySelector('[data-new-file-dialog]');
      if (dialogElement && dialogElement.contains(target)) {
        return; // 다이얼로그 내부 이벤트는 허용
      }

      // 다이얼로그 외부에서 발생한 핫키만 차단
      if ((e.ctrlKey && (e.key === 'f' || e.key === 'F' || e.key === 'z' || e.key === 'Z')) || 
          e.key === '/' ||
          (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-')) ||
          e.key === 'n' || e.key === 'N' ||
          e.key === 'e' || e.key === 'E' ||
          e.key === 'p' || e.key === 'P' ||
          e.key === 'o' || e.key === 'O' ||
          e.key === 'b' || e.key === 'B' ||
          e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  const handleCreate = async () => {
    const availableTypes = getFileTypes(isMyMemo);
    const selectedType = availableTypes[selectedTypeIndex];
    
    // 템플릿 타입은 템플릿 목록 팝업 표시
    if (selectedType.type === 'template') {
      if (onSelectTemplate) {
        onSelectTemplate(fileName.trim() || '템플릿 인스턴스');
      }
      return;
    }

    if (!fileName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const fullPath = joinPath(currentPath, `${fileName.trim()}${selectedType.extension}`);

      if (selectedType.type === 'folder') {
        await window.api.filesystem.createDirectory(fullPath);
        onCreated(); // 폴더는 경로 전달 안 함
      } else {
        const initialContent = selectedType.type === 'markdown' ? '# ' : '';
        await window.api.filesystem.createFile(fullPath, initialContent);
        onCreated(fullPath); // 파일은 경로 전달
      }

      onClose();
    } catch (err) {
      const errorMessage = getErrorMessage(err, '생성 중 오류가 발생했습니다.');
      setError(errorMessage);
      console.error('Error creating file/directory:', err);
    }
  };

  return (
    <div
      data-new-file-dialog
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        // 다이얼로그 외부로 키 이벤트 전파 차단
        e.stopPropagation();
        handleKeyDown(e);
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => {
          e.stopPropagation();
          handleDialogClick(e);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          handleKeyDown(e);
        }}
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">새로 만들기</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            이름
          </label>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => {
              setFileName(e.target.value);
              setError(null);
            }}
            disabled={getFileTypes(isMyMemo)[selectedTypeIndex]?.type === 'template'}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="이름을 입력하세요"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            타입 (위/아래 화살표로 선택)
          </label>
          <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-1">
            {getFileTypes(isMyMemo).map((type, index) => {
              const isTemplate = type.type === 'template';
              const isSelected = selectedTypeIndex === index;
              
              return (
                <div
                  key={type.type}
                  className={`px-3 py-2 rounded cursor-pointer ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200'
                  }`}
                  onClick={() => {
                    setSelectedTypeIndex(index);
                    // 템플릿 타입을 클릭하면 템플릿 목록 팝업 표시
                    if (isTemplate && onSelectTemplate) {
                      onSelectTemplate(fileName.trim() || '템플릿 인스턴스');
                    }
                  }}
                >
                  {type.label}
                  {type.extension && <span className="text-xs ml-2">({type.extension})</span>}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            <span>취소</span>
            <span className="text-xs bg-gray-600 dark:bg-gray-500 text-white px-1.5 py-0.5 rounded">
              Esc
            </span>
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600"
          >
            <span>생성</span>
            <span className="text-xs bg-blue-700 text-white px-1.5 py-0.5 rounded">
              Enter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewFileDialog;

