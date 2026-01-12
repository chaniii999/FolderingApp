import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { getHotkeys, isHotkey } from '../config/hotkeys';
import { isTextFile, isPdfFile, isTemplateFile } from '../utils/fileUtils';
import { undoService } from '../services/undoService';
import { toastService } from '../services/toastService';
import { autoSaveService } from '../services/autoSaveService';
import { usePerformanceMeasure } from '../utils/usePerformanceMeasure';
import { useScrollAcceleration } from '../hooks/useScrollAcceleration';
import { getFileName } from '../utils/pathUtils';
import { handleError, getErrorMessage } from '../utils/errorHandler';
import RecoveryDialog from './RecoveryDialog';
import MarkdownViewer from './MarkdownViewer';
import PdfViewer from './PdfViewer';
import TemplateEditor from './MyMemo/TemplateEditor';
import { pdfExportService } from '../services/pdfExportService';

import type { TextEditorConfig } from '../services/textEditorConfigService';

export interface FileContentViewerRef {
  isEditing: boolean;
  hasChanges: boolean;
  isExportingPdf: boolean;
  handleEdit: () => void;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
  handleDelete: () => void;
  handleExportPdf: () => Promise<void>;
}

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
  onEditStateChange?: (state: { isEditing: boolean; hasChanges: boolean }) => void;
  onFileDeleted?: () => void;
  isDialogOpen?: boolean;
  onFocusExplorer?: () => void;
}

const FileContentViewer = forwardRef<FileContentViewerRef, FileContentViewerProps>(({ filePath, onSelectPreviousFile, onSelectNextFile, onDeselectFile, textEditorConfig, autoEdit = false, onEditModeEntered, onRenameRequest: _onRenameRequest, onEditModeChange, onEditStateChange, onFileDeleted, isDialogOpen = false, onFocusExplorer }, ref) => {
  usePerformanceMeasure('FileContentViewer');
  const config = textEditorConfig || { horizontalPadding: 80, fontSize: 14 };
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [dialogSelectedOption, setDialogSelectedOption] = useState<'save' | 'cancel'>('save');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const saveDialogRef = useRef<HTMLDivElement>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryContent, setRecoveryContent] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const lastContentRef = useRef<string>('');
  const cursorPositionMapRef = useRef<Map<string, number>>(new Map());
  
  const { startScrolling, stopScrolling } = useScrollAcceleration({
    scrollContainerRef,
  });

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

        // PDF 파일인 경우 별도 처리하지 않고 뷰어에서 처리
        if (isPdfFile(filePath)) {
          setContent('');
          setOriginalContent('');
          setIsTemplate(false);
          setLoading(false);
          return;
        }

        // 템플릿 파일인지 확인
        const templateFile = await isTemplateFile(filePath);
        setIsTemplate(templateFile);

        // 텍스트 파일이 아닌 경우 에러 표시하고 데이터 로드하지 않음
        if (!isTextFile(filePath)) {
          setError('표시할 수 없는 파일입니다!');
          setContent('');
          setOriginalContent('');
          setIsTemplate(false);
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
        const errorMessage = getErrorMessage(err, '파일을 읽는 중 오류가 발생했습니다.');
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
      // 약간의 지연을 두어 DOM 업데이트 후 포커스
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
  }, [isEditing]);

  // 편집 모드 진입 시 히스토리 초기화 및 커서 위치 복원
  useEffect(() => {
    if (isEditing && content && filePath) {
      editHistoryRef.current = [content];
      historyIndexRef.current = 0;
      lastContentRef.current = content;
      
      // 저장된 커서 위치 복원
      const savedCursorPosition = cursorPositionMapRef.current.get(filePath);
      if (savedCursorPosition !== undefined && textareaRef.current) {
        setTimeout(() => {
          if (textareaRef.current) {
            // 저장된 위치가 내용 길이를 초과하지 않도록 제한
            const cursorPosition = Math.min(savedCursorPosition, content.length);
            textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
            textareaRef.current.focus();
          }
        }, 0);
      }
    }
  }, [isEditing, filePath]); // content는 의존성에서 제외 (편집 모드 진입 시에만 초기화)

  // 새로 생성된 파일인 경우 자동으로 편집 모드 진입
  useEffect(() => {
    if (autoEdit && filePath && !loading && !error && !isEditing) {
      setIsEditing(true);
      if (onEditModeEntered) {
        onEditModeEntered();
      }
      // 편집 모드 진입 후 포커스 확실히 주기
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 10);
    }
  }, [autoEdit, filePath, loading, error, isEditing, onEditModeEntered]);

  // 편집 모드 변경 시 콜백 호출 (무한 루프 방지를 위해 useRef 사용)
  const onEditStateChangeRef = useRef(onEditStateChange);
  const onEditModeChangeRef = useRef(onEditModeChange);
  const prevStateRef = useRef<{ isEditing: boolean; hasChanges: boolean }>({ isEditing: false, hasChanges: false });

  // ref 업데이트 (함수가 변경될 때만)
  useEffect(() => {
    onEditStateChangeRef.current = onEditStateChange;
    onEditModeChangeRef.current = onEditModeChange;
  }, [onEditStateChange, onEditModeChange]);

  // 상태 변경 시에만 콜백 호출
  useEffect(() => {
    // 상태가 실제로 변경된 경우에만 콜백 호출
    if (prevStateRef.current.isEditing !== isEditing || prevStateRef.current.hasChanges !== hasChanges) {
      prevStateRef.current = { isEditing, hasChanges };
      
      if (onEditModeChangeRef.current) {
        onEditModeChangeRef.current(isEditing);
      }
      if (onEditStateChangeRef.current) {
        onEditStateChangeRef.current({ isEditing, hasChanges });
      }
    }
  }, [isEditing, hasChanges]); // 함수를 dependency에서 제거하여 무한 루프 방지 // onEditModeChange, onEditStateChange를 dependency에서 제거


  // 편집 모드가 종료되고 삭제 대기 중이면 삭제 다이얼로그 표시
  useEffect(() => {
    if (pendingDelete && !isEditing) {
      setPendingDelete(false);
      setShowDeleteDialog(true);
    }
  }, [pendingDelete, isEditing]);

  // 파일이 선택되었을 때는 편집 모드일 때만 포커스를 받음
  // 편집 모드가 아니면 FileExplorer에 포커스가 유지되어야 함
  // useEffect는 제거 - 편집 모드일 때만 textarea에 포커스가 가도록 함


  const handleDeleteClick = useCallback(() => {
    if (filePath) {
      // 편집 모드이면 먼저 편집 모드 종료
      if (isEditing) {
        // 변경사항을 버리고 편집 모드 종료
        setContent(originalContent);
        setHasChanges(false);
        setIsEditing(false);
        if (onEditModeChange) {
          onEditModeChange(false);
        }
        // 편집 모드 종료 후 삭제 다이얼로그 표시를 위해 플래그 설정
        setPendingDelete(true);
      } else {
        // 편집 모드가 아니면 바로 삭제 다이얼로그 표시
        setShowDeleteDialog(true);
      }
    }
  }, [filePath, isEditing, originalContent, onEditModeChange]);

  // 전역 키 이벤트 리스너 추가 (파일이 선택되었을 때 화살표 키 처리)
  useEffect(() => {
    if (!filePath || loading || isEditing || showSaveDialog || isDialogOpen) {
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있거나 편집 중이면 키 이벤트 처리하지 않음
      if (isDialogOpen || isEditing) {
        return;
      }

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
        startScrolling(direction);
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

      // Delete 키로 파일 삭제
      if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteClick();
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
  }, [filePath, loading, error, isEditing, showSaveDialog, isDialogOpen, stopScrolling, startScrolling, onSelectPreviousFile, onSelectNextFile, onDeselectFile, handleDeleteClick]);

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
      // 편집 중일 때는 저장/취소 키만 처리하고 나머지는 textarea에서 처리
      // Ctrl+S 저장
      if (isHotkey(e.key, 'save', e.nativeEvent)) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }
      
      // Esc 취소
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
        return;
      }
      
      // 나머지 키는 textarea에서 처리하도록 허용
      return;
    } else {
      // 편집 모드가 아닐 때 Delete 키로 파일 삭제
      if ((e.key === 'Delete' || e.key === 'Del') && filePath && !loading && !error) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteClick();
        return;
      }

      // 파일이 선택되어 있고 편집 모드가 아닐 때
      if (filePath && !loading && !error) {
        // 위/아래 화살표: 텍스트 스크롤 (가속도 적용)
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const direction = e.key === 'ArrowUp' ? 'up' : 'down';
          startScrolling(direction);
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

  const handleEditClick = useCallback(() => {
    if (filePath && !loading && !error) {
      setIsEditing(true);
      // 편집 모드 진입 시 자동 저장 시작
      if (filePath) {
        autoSaveService.startAutoSave(filePath, content);
      }
    }
  }, [filePath, loading, error, content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const oldContent = lastContentRef.current;
    
    // 내용이 실제로 변경된 경우에만 히스토리에 추가
    if (newContent !== oldContent && isEditing) {
      // 현재 인덱스 이후의 히스토리 제거 (새로운 분기)
      if (historyIndexRef.current < editHistoryRef.current.length - 1) {
        editHistoryRef.current = editHistoryRef.current.slice(0, historyIndexRef.current + 1);
      }
      // 이전 내용을 히스토리에 추가
      editHistoryRef.current.push(oldContent);
      // 히스토리 크기 제한 (최대 50개)
      if (editHistoryRef.current.length > 50) {
        editHistoryRef.current.shift();
      } else {
        historyIndexRef.current = editHistoryRef.current.length - 1;
      }
      lastContentRef.current = newContent;
    }
    
    setContent(newContent);
    // 내용 변경 시 자동 저장 업데이트
    if (filePath && isEditing) {
      autoSaveService.updateContent(filePath, newContent);
    }
  };

  /**
   * Shift + Enter: 현재 줄의 가장 끝 부분으로 커서 이동 후 개행문자 삽입
   */
  const handleShiftEnter = useCallback((textarea: HTMLTextAreaElement): void => {
    const currentPosition = textarea.selectionStart;
    const currentContent = textarea.value;
    
    // 현재 줄의 끝 위치 찾기
    let lineEnd = currentPosition;
    
    // 현재 위치부터 줄 끝까지 검색
    while (lineEnd < currentContent.length && currentContent[lineEnd] !== '\n') {
      lineEnd++;
    }
    
    // 줄 끝에 개행문자 삽입
    const newContent = currentContent.slice(0, lineEnd) + '\n' + currentContent.slice(lineEnd);
    setContent(newContent);
    
    // 커서를 개행문자 다음 위치(다음 줄 시작)로 이동
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = lineEnd + 1;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
    
    // 자동 저장 업데이트
    if (filePath && isEditing) {
      autoSaveService.updateContent(filePath, newContent);
    }
  }, [filePath, isEditing]);

  /**
   * Ctrl + Enter: 텍스트 맨 뒤로 이동 (개행문자를 만나면 그 전 위치로)
   */
  const handleCtrlEnter = useCallback((textarea: HTMLTextAreaElement): void => {
    const currentContent = textarea.value;
    
    // 텍스트 끝 위치
    let endPosition = currentContent.length;
    
    // 마지막 문자가 개행문자면 그 전 위치로 이동
    if (endPosition > 0 && currentContent[endPosition - 1] === '\n') {
      endPosition--;
    }
    
    // 커서를 텍스트 끝(또는 개행문자 전)으로 이동
    textarea.setSelectionRange(endPosition, endPosition);
  }, []);

  /**
   * Ctrl + Z: 되돌리기
   */
  const handleUndo = useCallback((textarea: HTMLTextAreaElement): void => {
    if (editHistoryRef.current.length === 0 || historyIndexRef.current < 0) {
      return;
    }
    
    // 현재 내용을 히스토리에 저장 (되돌리기 후 다시 되돌릴 수 있도록)
    const currentContent = textarea.value;
    if (currentContent !== lastContentRef.current) {
      // 현재 인덱스 이후의 히스토리 제거
      if (historyIndexRef.current < editHistoryRef.current.length - 1) {
        editHistoryRef.current = editHistoryRef.current.slice(0, historyIndexRef.current + 1);
      }
      editHistoryRef.current.push(currentContent);
      if (editHistoryRef.current.length > 50) {
        editHistoryRef.current.shift();
      } else {
        historyIndexRef.current = editHistoryRef.current.length - 1;
      }
    }
    
    // 이전 상태로 되돌리기
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previousContent = editHistoryRef.current[historyIndexRef.current];
      setContent(previousContent);
      lastContentRef.current = previousContent;
      
      // 자동 저장 업데이트
      if (filePath && isEditing) {
        autoSaveService.updateContent(filePath, previousContent);
      }
      
      // 커서 위치 유지
      setTimeout(() => {
        if (textareaRef.current) {
          const cursorPos = Math.min(textarea.selectionStart, previousContent.length);
          textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    }
  }, [filePath, isEditing]);

  const handleSave = useCallback(async (newContent?: string) => {
    const contentToSave = newContent ?? content;
    
    if (!filePath) return;
    
    // 템플릿이 아닌 경우 hasChanges 체크
    if (!isTemplate && !hasChanges) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      if (typeof window.api.filesystem.writeFile !== 'function') {
        throw new Error('writeFile 함수를 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
      }

      await window.api.filesystem.writeFile(filePath, contentToSave);
      
      // 저장 시 커서 위치 저장
      if (textareaRef.current && filePath) {
        const cursorPosition = textareaRef.current.selectionStart;
        cursorPositionMapRef.current.set(filePath, cursorPosition);
      }
      
      // content state 업데이트
      if (newContent) {
        setContent(newContent);
      }
      setOriginalContent(contentToSave);
      setHasChanges(false);
      setIsEditing(false);
      
      // 저장 성공 시 자동 저장 정리
      if (filePath) {
        await autoSaveService.clearAutoSave(filePath);
      }
      
      toastService.success('저장됨');
    } catch (err) {
      // handleError는 토스트를 표시하고 에러 메시지를 반환함
      const errorMessage = handleError(err, '파일 저장 중 오류가 발생했습니다.');
      setError(errorMessage);
      
      // 저장 실패 시 복구 가능한지 확인
      if (filePath) {
        try {
          const recovery = await autoSaveService.getRecoveryContent(filePath);
          if (recovery) {
            setRecoveryContent(recovery);
            setShowRecoveryDialog(true);
          }
        } catch (recoveryErr) {
          console.error('Error checking recovery:', recoveryErr);
        }
      }
    }
  }, [filePath, hasChanges, content]);

  const handleCancel = useCallback(() => {
    // 취소 시 커서 위치 저장
    if (textareaRef.current && filePath) {
      const cursorPosition = textareaRef.current.selectionStart;
      cursorPositionMapRef.current.set(filePath, cursorPosition);
    }
    
    if (hasChanges) {
      setShowSaveDialog(true);
      setDialogSelectedOption('save');
    } else {
      setContent(originalContent);
      setHasChanges(false);
      setIsEditing(false);
      setShowSaveDialog(false);
      
      // 편집 모드 종료 시 자동 저장 중지
      if (filePath) {
        autoSaveService.stopAutoSave(filePath);
      }
    }
  }, [hasChanges, originalContent, filePath]);

  const handleSaveDialogConfirm = async () => {
    await handleSave();
    setShowSaveDialog(false);
  };

  const handleSaveDialogCancel = () => {
    // 취소 시 커서 위치 저장 (다이얼로그가 열리기 전에 저장된 위치 사용)
    if (filePath && cursorPositionMapRef.current.has(filePath)) {
      // 이미 저장된 위치가 있으면 유지
    }
    
    setContent(originalContent);
    setHasChanges(false);
    setIsEditing(false);
    setShowSaveDialog(false);
  };

  /**
   * PDF로 내보내기
   */
  const handleExportPdf = useCallback(async (): Promise<void> => {
    if (!filePath || !content) {
      toastService.error('내보낼 내용이 없습니다.');
      return;
    }

    if (isExportingPdf) {
      return; // 이미 내보내기 중이면 무시
    }

    setIsExportingPdf(true);
    try {
      const fileName = getFileName(filePath);
      const defaultFileName = `${fileName.replace(/\.[^/.]+$/, '')}.pdf`;
      const isMarkdown = isMarkdownFile(filePath);

      // HTML 변환 (마크다운은 비동기 처리)
      let htmlContent: string;
      try {
        htmlContent = await pdfExportService.convertTextToHtml(content, config, isMarkdown);
      } catch (convertError) {
        const err = convertError as Error;
        toastService.error(`콘텐츠 변환 실패: ${err.message}`);
        return;
      }

      const success = await pdfExportService.exportToPDF(htmlContent, defaultFileName);
      if (!success) {
        // 사용자가 취소한 경우는 에러로 표시하지 않음 (이미 서비스에서 처리됨)
        return;
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      const err = error as Error;
      const errorMessage = err.message || 'PDF 내보내기 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
    } finally {
      setIsExportingPdf(false);
    }
  }, [filePath, content, config, isExportingPdf]);

  // ref를 통해 외부에 노출 (모든 핸들러가 선언된 후)
  useImperativeHandle(ref, () => ({
    isEditing,
    hasChanges,
    isExportingPdf,
    handleEdit: handleEditClick,
    handleSave,
    handleCancel,
    handleDelete: handleDeleteClick,
    handleExportPdf,
  }), [isEditing, hasChanges, isExportingPdf, handleEditClick, handleSave, handleCancel, handleDeleteClick, handleExportPdf]);

  const handleDeleteConfirm = async () => {
    if (!filePath) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      // 삭제 전에 파일 내용 읽기 (되돌리기용)
      let fileContent = '';
      if (window.api?.filesystem?.readFile) {
        try {
          const content = await window.api.filesystem.readFile(filePath);
          fileContent = content || '';
        } catch (err) {
          console.error('Error reading file for undo:', err);
        }
      }

      // 작업 히스토리에 추가
      undoService.addAction({
        type: 'delete',
        path: filePath,
        isDirectory: false,
        content: fileContent,
      });

      // 파일 삭제
      await window.api.filesystem.deleteFile(filePath);

      setShowDeleteDialog(false);
      
      // 파일 선택 해제
      if (onDeselectFile) {
        onDeselectFile();
      }

      // 디렉토리 새로고침
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (err) {
      handleError(err, '삭제 중 오류가 발생했습니다.');
      setShowDeleteDialog(false);
    }
  };

  useEffect(() => {
    if (showDeleteDialog && deleteDialogRef.current) {
      deleteDialogRef.current.focus();
    }
  }, [showDeleteDialog]);

  // 저장 다이얼로그가 열리기 전에 커서 위치 저장
  useEffect(() => {
    if (showSaveDialog && textareaRef.current && filePath) {
      const cursorPosition = textareaRef.current.selectionStart;
      cursorPositionMapRef.current.set(filePath, cursorPosition);
    }
  }, [showSaveDialog, filePath]);

  useEffect(() => {
    if (showSaveDialog && saveDialogRef.current) {
      // textarea 포커스 제거
      if (textareaRef.current) {
        textareaRef.current.blur();
      }
      // 다이얼로그에 포커스
      setTimeout(() => {
        if (saveDialogRef.current) {
          saveDialogRef.current.focus();
        }
      }, 0);
    }
  }, [showSaveDialog]);

  const handleBlankAreaClick = () => {
    if (!filePath && onFocusExplorer) {
      onFocusExplorer();
    }
  };

  if (!filePath) {
    return (
      <div 
        className="flex flex-col h-full cursor-pointer"
        onClick={handleBlankAreaClick}
      >
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
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
      tabIndex={isDialogOpen ? -1 : (isEditing || (filePath && !loading && !error) ? 0 : -1)}
    >
      <div 
        ref={scrollContainerRef}
        className={`flex-1 bg-white dark:bg-gray-800 relative ${isEditing ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">파일을 불러오는 중...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          </div>
        ) : isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={(e) => {
              // 저장 다이얼로그가 열려있으면 모든 키 입력 차단
              if (showSaveDialog) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              
              // Shift + Enter: 다음 줄로 줄바꿈(커서 이동)
              if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                if (textareaRef.current) {
                  handleShiftEnter(textareaRef.current);
                }
                return;
              }
              
              // Ctrl + Enter: 현재 줄의 가장 끝 부분으로 커서 이동
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (textareaRef.current) {
                  handleCtrlEnter(textareaRef.current);
                }
                return;
              }
              
              // Ctrl + Z: 되돌리기
              if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (textareaRef.current) {
                  handleUndo(textareaRef.current);
                }
                return;
              }
              
              // 저장/취소 키는 먼저 처리
              if (isHotkey(e.key, 'save', e.nativeEvent)) {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
                return;
              }
              
              if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
                return;
              }
              
              // 나머지 모든 키 이벤트는 상위로 전파하지 않음
              // 이렇게 하면 window 레벨의 핫키 핸들러가 실행되지 않음
              e.stopPropagation();
            }}
            tabIndex={showSaveDialog ? -1 : 0}
            className="w-full h-full font-mono resize-none border-none outline-none overflow-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            style={{
              paddingLeft: `${config.horizontalPadding}px`,
              paddingRight: `${config.horizontalPadding}px`,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              fontSize: `${config.fontSize}px`,
            }}
            spellCheck={false}
          />
        ) : isPdfFile(filePath) ? (
          <PdfViewer filePath={filePath} />
        ) : isTemplate ? (
          <TemplateEditor
            filePath={filePath!}
            content={content}
            onSave={async (newContent: string) => {
              await handleSave(newContent);
            }}
            onCancel={handleCancel}
            config={config}
          />
        ) : isMarkdownFile(filePath) ? (
          <MarkdownViewer content={content} config={config} />
        ) : (
          <pre 
            className="font-mono whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100"
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
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
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
            ref={saveDialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // 다이얼로그 내부 키 이벤트 처리
              e.stopPropagation();
              
              // z 또는 Enter로 저장
              if (isHotkey(e.key, 'enter') || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault();
                if (dialogSelectedOption === 'save') {
                  handleSaveDialogConfirm();
                } else {
                  setDialogSelectedOption('save');
                }
                return;
              }
              
              // x 또는 Esc로 취소
              if (isHotkey(e.key, 'goBack') || e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                if (dialogSelectedOption === 'cancel') {
                  handleSaveDialogCancel();
                } else {
                  setDialogSelectedOption('cancel');
                }
                return;
              }
            }}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">저장하시겠습니까?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              변경사항이 저장되지 않았습니다. 저장하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveDialogCancel}
                className={`px-4 py-2 rounded flex items-center gap-2 ${
                  dialogSelectedOption === 'cancel'
                    ? 'bg-gray-400 dark:bg-gray-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <span>취소</span>
                <span className="text-xs bg-gray-600 dark:bg-gray-500 text-white px-1.5 py-0.5 rounded">
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
      
      {showDeleteDialog && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
          onClick={(e) => {
            // 다이얼로그 외부 클릭 시 이벤트 차단
            e.stopPropagation();
          }}
        >
          <div 
            ref={deleteDialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            onKeyDown={(e) => {
              // 다이얼로그 외부의 키 이벤트 차단
              e.stopPropagation();
              
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleDeleteConfirm();
              } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                setShowDeleteDialog(false);
              }
            }}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">삭제 확인</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {filePath ? getFileName(filePath) : filePath}을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소 (Esc)
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
              >
                삭제 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showRecoveryDialog && recoveryContent !== null && filePath && (
        <RecoveryDialog
          fileName={getFileName(filePath)}
          onRecover={async () => {
            setContent(recoveryContent);
            setHasChanges(true);
            setShowRecoveryDialog(false);
            setRecoveryContent(null);
            // 복구 후 다시 저장 시도
            try {
              await handleSave();
            } catch (err) {
              console.error('Error saving after recovery:', err);
            }
          }}
          onDiscard={() => {
            setShowRecoveryDialog(false);
            setRecoveryContent(null);
          }}
        />
      )}
    </div>
  );
});

FileContentViewer.displayName = 'FileContentViewer';

export default FileContentViewer;
