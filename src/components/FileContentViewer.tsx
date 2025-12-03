import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHotkeys, isHotkey } from '../config/hotkeys';
import { isTextFile } from '../utils/fileUtils';

import type { TextEditorConfig } from '../services/textEditorConfigService';

interface FileContentViewerProps {
  filePath: string | null;
  onSelectPreviousFile?: () => void;
  onSelectNextFile?: () => void;
  onDeselectFile?: () => void;
  textEditorConfig?: TextEditorConfig;
  autoEdit?: boolean;
  onEditModeEntered?: () => void;
  onRenameRequest?: (filePath: string) => void;
  onEditModeChange?: (isEditing: boolean) => void;
}

function FileContentViewer({ filePath, onSelectPreviousFile, onSelectNextFile, onDeselectFile, textEditorConfig, autoEdit = false, onEditModeEntered, onRenameRequest, onEditModeChange }: FileContentViewerProps) {
  const config = textEditorConfig || { horizontalPadding: 80, fontSize: 14 };
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
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollSpeedRef = useRef<number>(1);
  const scrollStartTimeRef = useRef<number>(0);

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

        // 텍스트 파일이 아닌 경우 에러 표시하고 데이터 로드하지 않음
        if (!isTextFile(filePath)) {
          setError('표시할 수 없는 파일입니다!');
          setContent('');
          setOriginalContent('');
          setLoading(false);
          return;
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

  // 새로 생성된 파일인 경우 자동으로 편집 모드 진입
  useEffect(() => {
    if (autoEdit && filePath && !loading && !error && !isEditing) {
      setIsEditing(true);
      if (onEditModeEntered) {
        onEditModeEntered();
      }
    }
  }, [autoEdit, filePath, loading, error, isEditing, onEditModeEntered]);

  // 편집 모드 변경 시 콜백 호출
  useEffect(() => {
    if (onEditModeChange) {
      onEditModeChange(isEditing);
    }
  }, [isEditing, onEditModeChange]);

  // 파일이 선택되었을 때는 편집 모드일 때만 포커스를 받음
  // 편집 모드가 아니면 FileExplorer에 포커스가 유지되어야 함
  // useEffect는 제거 - 편집 모드일 때만 textarea에 포커스가 가도록 함

  const stopScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    scrollDirectionRef.current = null;
    scrollSpeedRef.current = 1;
  }, []);

  const performScroll = useCallback((direction: 'up' | 'down', speed: number) => {
    if (!scrollContainerRef.current) return;
    
    const baseScrollAmount = 30; // 기본 스크롤 양
    const scrollAmount = baseScrollAmount * speed;
    const currentScroll = scrollContainerRef.current.scrollTop;
    const newScroll = direction === 'up' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    
    scrollContainerRef.current.scrollTo({
      top: newScroll,
      behavior: 'auto' // 가속도를 위해 smooth 대신 auto 사용
    });
  }, []);

  // 전역 키 이벤트 리스너 추가 (파일이 선택되었을 때 화살표 키 처리)
  useEffect(() => {
    if (!filePath || loading || isEditing || showSaveDialog) {
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // "i" 키로 편집 모드 진입 (파일이 선택되어 있을 때만)
      if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
        return;
      }

      // 위/아래 화살표: 텍스트 스크롤 (가속도 적용) - 에러가 없을 때만 작동
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !error) {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.key === 'ArrowUp' ? 'up' : 'down';
        
        // 이미 스크롤 중이면 방향만 업데이트
        if (scrollIntervalRef.current && scrollDirectionRef.current === direction) {
          return;
        }
        
        // 기존 스크롤 중지
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
        }
        
        scrollDirectionRef.current = direction;
        scrollStartTimeRef.current = Date.now();
        scrollSpeedRef.current = 1;
        
        // 첫 스크롤 즉시 실행
        performScroll(direction, 1);
        
        // 연속 스크롤 시작
        scrollIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - scrollStartTimeRef.current;
          // 시간에 따라 속도 증가 (크롬 브라우저 스타일)
          // 0-500ms: 속도 1, 500-1000ms: 속도 2, 1000-2000ms: 속도 3, 이후: 속도 4 (최대)
          if (elapsed < 500) {
            scrollSpeedRef.current = 1;
          } else if (elapsed < 1000) {
            scrollSpeedRef.current = 2;
          } else if (elapsed < 2000) {
            scrollSpeedRef.current = 3;
          } else {
            scrollSpeedRef.current = 4;
          }
          performScroll(direction, scrollSpeedRef.current);
        }, 50); // 50ms마다 스크롤 (크롬과 유사)
        
        return;
      }

      // 왼쪽 화살표: 이전 파일 선택
      if (e.key === 'ArrowLeft' && onSelectPreviousFile) {
        e.preventDefault();
        e.stopPropagation();
        onSelectPreviousFile();
        return;
      }

      // 오른쪽 화살표: 다음 파일 선택
      if (e.key === 'ArrowRight' && onSelectNextFile) {
        e.preventDefault();
        e.stopPropagation();
        onSelectNextFile();
        return;
      }

      // x 키로 파일 선택 해제 (뒤로가기)
      if (isHotkey(e.key, 'goBack') && onDeselectFile) {
        e.preventDefault();
        e.stopPropagation();
        onDeselectFile();
        return;
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      // 위/아래 화살표 키를 떼면 스크롤 중지
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        stopScrolling();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('keyup', handleGlobalKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('keyup', handleGlobalKeyUp, true);
    };
  }, [filePath, loading, error, isEditing, showSaveDialog, stopScrolling, performScroll, onSelectPreviousFile, onSelectNextFile, onDeselectFile, isHotkey]);

  useEffect(() => {
    if (content !== originalContent) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [content, originalContent]);

  useEffect(() => {
    // 컴포넌트 언마운트 시 스크롤 중지
    return () => {
      stopScrolling();
    };
  }, [stopScrolling]);

  // 포커스가 벗어나면 스크롤 중지
  useEffect(() => {
    const handleBlur = () => {
      stopScrolling();
    };
    
    if (containerRef.current) {
      containerRef.current.addEventListener('blur', handleBlur);
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('blur', handleBlur);
        }
      };
    }
  }, [stopScrolling]);

  const handleKeyUp = (e: React.KeyboardEvent) => {
    // 위/아래 화살표 키를 떼면 스크롤 중지
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      stopScrolling();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 알림창이 떴을 때는 z/x 또는 Enter/Esc 처리
    if (showSaveDialog) {
      e.preventDefault();
      e.stopPropagation();
      
      // z 또는 Enter로 저장 옵션 선택 또는 저장 실행
      if (isHotkey(e.key, 'enter') || (e.key === 'Enter' && !e.shiftKey)) {
        if (dialogSelectedOption === 'save') {
          handleSaveDialogConfirm();
        } else {
          setDialogSelectedOption('save');
        }
        return;
      }
      
      // x 또는 Esc로 취소 옵션 선택 또는 취소 실행
      if (isHotkey(e.key, 'goBack') || e.key === 'Escape' || e.key === 'Esc') {
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
        // 위/아래 화살표: 텍스트 스크롤 (가속도 적용)
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const direction = e.key === 'ArrowUp' ? 'up' : 'down';
          
          // 이미 스크롤 중이면 방향만 업데이트
          if (scrollIntervalRef.current && scrollDirectionRef.current === direction) {
            return;
          }
          
          // 기존 스크롤 중지
          if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
          }
          
          scrollDirectionRef.current = direction;
          scrollStartTimeRef.current = Date.now();
          scrollSpeedRef.current = 1;
          
          // 첫 스크롤 즉시 실행
          performScroll(direction, 1);
          
          // 연속 스크롤 시작
          scrollIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - scrollStartTimeRef.current;
            // 시간에 따라 속도 증가 (크롬 브라우저 스타일)
            // 0-500ms: 속도 1, 500-1000ms: 속도 2, 1000-2000ms: 속도 3, 이후: 속도 4 (최대)
            if (elapsed < 500) {
              scrollSpeedRef.current = 1;
            } else if (elapsed < 1000) {
              scrollSpeedRef.current = 2;
            } else if (elapsed < 2000) {
              scrollSpeedRef.current = 3;
            } else {
              scrollSpeedRef.current = 4;
            }
            performScroll(direction, scrollSpeedRef.current);
          }, 50); // 50ms마다 스크롤 (크롬과 유사)
          
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
        
        // i 키로 편집 모드 진입 (modifier 키 없을 때만)
        if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
      onKeyUp={handleKeyUp}
      tabIndex={isEditing || (filePath && !loading && !error) ? 0 : -1}
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
        className={`flex-1 bg-white relative ${isEditing ? 'overflow-hidden' : 'overflow-auto'}`}
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
            className="w-full h-full font-mono resize-none border-none outline-none overflow-auto"
            style={{
              paddingLeft: `${config.horizontalPadding}px`,
              paddingRight: `${config.horizontalPadding}px`,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              fontSize: `${config.fontSize}px`,
            }}
            spellCheck={false}
          />
        ) : isMarkdownFile(filePath) ? (
          <div 
            className="prose prose-sm max-w-none"
            style={{
              paddingLeft: `${config.horizontalPadding}px`,
              paddingRight: `${config.horizontalPadding}px`,
              paddingTop: '1.5rem',
              paddingBottom: '1.5rem',
              fontSize: `${config.fontSize}px`,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre 
            className="font-mono whitespace-pre-wrap break-words"
            style={{
              paddingLeft: `${config.horizontalPadding}px`,
              paddingRight: `${config.horizontalPadding}px`,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              fontSize: `${config.fontSize}px`,
            }}
          >
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
              onKeyDown={(e) => {
                // 다이얼로그 외부의 키 이벤트 차단
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
                  {getHotkeys().goBack}/Esc
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
                  {getHotkeys().enter}/Enter
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
