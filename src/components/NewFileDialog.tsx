import { useState, useEffect, useRef } from 'react';
import { joinPath } from '../utils/pathUtils';
import { getErrorMessage } from '../utils/errorHandler';
import { isMyMemoMode } from '../services/myMemoService';
import TemplateManageDialog from './MyMemo/TemplateManageDialog';
import { useBlockGlobalHotkeys } from '../hooks/useBlockGlobalHotkeys';

export type FileType = 'folder' | 'file' | 'markdown' | 'template';

interface NewFileDialogProps {
  currentPath: string;
  onClose: () => void;
  onCreated: (filePath?: string, isDirectory?: boolean) => void;
  onSelectTemplate?: (template: import('../types/myMemo').CustomTemplate) => void;
  selectedTemplateName?: string | null; // 선택된 템플릿 이름
  showTemplateList?: boolean; // 템플릿 목록 표시 여부
  onTemplateListClose?: () => void; // 템플릿 목록 닫기
  onRequestTemplateList?: () => void; // 템플릿 목록 요청
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

function NewFileDialog({ currentPath, onClose, onCreated, onSelectTemplate, selectedTemplateName, showTemplateList = false, onTemplateListClose, onRequestTemplateList }: NewFileDialogProps) {
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
    if (inputRef.current && !showTemplateList) {
      inputRef.current.focus();
    }
  }, [showTemplateList]);

  // 템플릿이 선택되면 타입 인덱스를 템플릿으로 설정
  useEffect(() => {
    if (selectedTemplateName && isMyMemo) {
      const availableTypes = getFileTypes(isMyMemo);
      const templateIndex = availableTypes.findIndex(type => type.type === 'template');
      if (templateIndex >= 0 && selectedTypeIndex !== templateIndex) {
        setSelectedTypeIndex(templateIndex);
      }
    }
  }, [selectedTemplateName, isMyMemo, selectedTypeIndex]);

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
    // input 필드에서 발생한 이벤트는 처리하지 않음 (input 필드에서 직접 처리)
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    
    // 모든 키 이벤트를 다이얼로그 내부에서만 처리하도록 전파 차단
    e.stopPropagation();
    
    const availableTypes = getFileTypes(isMyMemo);
    const selectedType = availableTypes[selectedTypeIndex];
    
    // Enter로 확인 처리
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 템플릿 타입이 선택된 경우
      if (selectedType.type === 'template') {
        // 이름이 입력되지 않았으면 경고 메시지 표시
        if (!fileName.trim()) {
          setError('이름을 먼저 입력해주세요.');
          return;
        }
        // 템플릿이 이미 선택되어 있으면 생성
        if (selectedTemplateName) {
          handleCreate();
          return;
        }
        // 템플릿이 선택되지 않았으면 템플릿 목록 팝업 표시
        if (onRequestTemplateList) {
          onRequestTemplateList();
        }
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

  // 전역 핫키 차단
  useBlockGlobalHotkeys({
    dialogSelector: '[data-new-file-dialog]',
    allowArrowKeysInInput: true,
  });

  // 다이얼로그가 열려있을 때 모든 전역 키 이벤트 완전 차단 (capture phase)
  // 가장 높은 우선순위로 등록하여 다른 모든 핸들러보다 먼저 실행
  useEffect(() => {
    const handleGlobalKeyDownCapture = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const dialogElement = target?.closest('[data-new-file-dialog]');
      
      if (dialogElement) {
        const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
        
        // input 필드의 이벤트는 React 이벤트가 정상 실행되도록 차단하지 않음
        // 다이얼로그의 다른 부분에서 발생한 이벤트만 다른 전역 핸들러 차단
        if (!isInput) {
          // 다이얼로그 내부에서 발생한 키 이벤트는 다른 전역 핸들러가 처리하지 않도록 차단
          // preventDefault는 호출하지 않아서 React 이벤트는 정상 실행되도록 함
          // stopPropagation으로 다른 전역 핸들러만 차단
          e.stopPropagation();
        }
      }
    };

    // capture phase에서 등록하여 다른 모든 핸들러보다 먼저 실행
    window.addEventListener('keydown', handleGlobalKeyDownCapture, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDownCapture, true);
    };
  }, []);

  const handleCreate = async () => {
    const availableTypes = getFileTypes(isMyMemo);
    const selectedType = availableTypes[selectedTypeIndex];
    
      // 템플릿 타입 처리
      if (selectedType.type === 'template') {
        // 템플릿이 선택되지 않았으면 템플릿 목록 팝업 표시
        if (!selectedTemplateName) {
          if (onRequestTemplateList) {
            onRequestTemplateList();
          }
          return;
        }
      // 템플릿이 선택되었으면 생성은 onCreated에서 처리 (App.tsx에서)
      // 여기서는 파일명만 검증
      if (!fileName.trim()) {
        setError('이름을 입력해주세요.');
        return;
      }
      // 템플릿 인스턴스 생성은 App.tsx의 handleNewFileCreated에서 처리
      // 파일명을 전달하여 템플릿 인스턴스 생성에 사용 (항상 파일이므로 isDirectory: false)
      onCreated(fileName.trim(), false);
      onClose();
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
        onCreated(fullPath, true); // 폴더 경로와 isDirectory 플래그 전달
      } else {
        const initialContent = selectedType.type === 'markdown' ? '# ' : '';
        await window.api.filesystem.createFile(fullPath, initialContent);
        onCreated(fullPath, false); // 파일 경로와 isDirectory 플래그 전달
      }

      onClose();
    } catch (err) {
      const errorMessage = getErrorMessage(err, '생성 중 오류가 발생했습니다.');
      setError(errorMessage);
      console.error('Error creating file/directory:', err);
    }
  };

  return (
    <>
    <div
      data-new-file-dialog
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showTemplateList) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        // 다이얼로그 외부로 키 이벤트 전파 차단
        e.stopPropagation();
        // Enter와 화살표 키는 다이얼로그 내부에서 처리
        if (!showTemplateList && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape' || e.key === 'Esc')) {
          handleKeyDown(e);
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => {
          e.stopPropagation();
          handleDialogClick(e);
        }}
        onKeyDown={(e) => {
          // input 필드에서 발생한 이벤트는 처리하지 않음 (input 필드에서 직접 처리)
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
          }
          
          e.stopPropagation();
          // Enter와 화살표 키는 다이얼로그 내부에서 처리
          if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape' || e.key === 'Esc') {
            handleKeyDown(e);
          }
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
            onKeyDown={(e) => {
              // input 필드에서 Enter와 Esc만 처리
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                const availableTypes = getFileTypes(isMyMemo);
                const selectedType = availableTypes[selectedTypeIndex];
                // 템플릿 타입이 선택된 경우
                if (selectedType.type === 'template') {
                  // 이름이 입력되지 않았으면 경고 메시지 표시
                  if (!fileName.trim()) {
                    setError('이름을 먼저 입력해주세요.');
                    return;
                  }
                  // 템플릿이 이미 선택되어 있으면 생성
                  if (selectedTemplateName) {
                    handleCreate();
                    return;
                  }
                  // 템플릿이 선택되지 않았으면 템플릿 목록 팝업 표시
                  if (onRequestTemplateList) {
                    onRequestTemplateList();
                  }
                  return;
                }
                handleCreate();
              } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              } else if (e.key === 'ArrowUp') {
                // 위 화살표 키: 타입 선택 (커서 이동 방지)
                e.preventDefault();
                e.stopPropagation();
                setSelectedTypeIndex((prev) => (prev > 0 ? prev - 1 : prev));
              } else if (e.key === 'ArrowDown') {
                // 아래 화살표 키: 타입 선택 (커서 이동 방지)
                e.preventDefault();
                e.stopPropagation();
                const availableTypes = getFileTypes(isMyMemo);
                setSelectedTypeIndex((prev) => (prev < availableTypes.length - 1 ? prev + 1 : prev));
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                    if (isTemplate && !selectedTemplateName) {
                      // 이름이 입력되지 않았으면 경고 메시지 표시
                      if (!fileName.trim()) {
                        setError('이름을 먼저 입력해주세요.');
                        return;
                      }
                      if (onRequestTemplateList) {
                        onRequestTemplateList();
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {type.label}
                      {type.extension && <span className="text-xs ml-2">({type.extension})</span>}
                    </span>
                    {isTemplate && isSelected && selectedTemplateName && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded ml-2">
                        {selectedTemplateName}
                      </span>
                    )}
                  </div>
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
      {showTemplateList && onTemplateListClose && (
        <TemplateManageDialog
          onClose={onTemplateListClose}
          onTemplateSelect={undefined}
          onTemplateInstanceCreate={undefined}
          isInstanceMode={true}
          defaultFileName={fileName.trim() || '템플릿 인스턴스'}
          onBackToNewFile={(template) => {
            // 템플릿이 선택되면 onSelectTemplate으로 전달
            if (template && onSelectTemplate) {
              onSelectTemplate(template);
            }
            if (onTemplateListClose) {
              onTemplateListClose();
            }
          }}
        />
      )}
    </div>
    </>
  );
}

export default NewFileDialog;

