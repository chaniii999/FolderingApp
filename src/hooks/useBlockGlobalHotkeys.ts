import { useEffect, useRef } from 'react';

interface UseBlockGlobalHotkeysOptions {
  /**
   * 다이얼로그 요소를 식별하는 방법
   * - string: data 속성 선택자 (예: '[data-new-file-dialog]')
   * - React.RefObject<HTMLElement>: ref 객체
   */
  dialogSelector?: string | React.RefObject<HTMLElement>;
  
  /**
   * 입력 필드 내부의 화살표 키 허용 여부
   * @default true
   */
  allowArrowKeysInInput?: boolean;
  
  /**
   * 차단할 핫키 목록 (기본값 사용 시 undefined)
   */
  blockedHotkeys?: string[];
}

/**
 * 다이얼로그가 열려있을 때 전역 핫키를 차단하는 커스텀 훅
 * 
 * @param options 설정 옵션
 */
export function useBlockGlobalHotkeys(options: UseBlockGlobalHotkeysOptions = {}): void {
  const {
    dialogSelector,
    allowArrowKeysInInput = true,
    blockedHotkeys,
  } = options;

  // 기본 차단할 핫키 목록
  const defaultBlockedHotkeys = [
    'f', 'F', 'z', 'Z', // Ctrl+F, Ctrl+Z
    '/', // 검색
    '+', '=', '-', // Ctrl+Plus, Ctrl+Minus
    'n', 'N', // 새 파일
    'e', 'E', // 편집
    'p', 'P', // PDF 내보내기
    'o', 'O', // 폴더 열기
    'b', 'B', // 뒤로가기
    'i', 'I', // 편집 모드
  ];

  const hotkeysToBlock = blockedHotkeys || defaultBlockedHotkeys;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      
      // 다이얼로그 내부 요소 확인
      let dialogElement: HTMLElement | null = null;
      
      if (dialogSelector) {
        if (typeof dialogSelector === 'string') {
          dialogElement = document.querySelector(dialogSelector);
        } else if (dialogSelector.current) {
          dialogElement = dialogSelector.current;
        }
      }

      const anyDialogElement = target.closest(
        '[data-new-file-dialog], [data-search-dialog], [data-template-manage-dialog], [data-template-edit-dialog], [data-save-confirm-dialog], [data-recovery-dialog]'
      );
      if (anyDialogElement && (!dialogElement || !dialogElement.contains(target))) {
        return;
      }

      // 다이얼로그 내부 요소에서 발생한 이벤트 처리
      if (dialogElement && dialogElement.contains(target)) {
        const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        
        // 입력 필드 내부에서는 모든 키 이벤트를 React 이벤트가 처리하도록 허용
        // stopPropagation을 호출하지 않아서 React 이벤트가 정상 실행되도록 함
        if (isInputElement) {
          // 입력 필드의 이벤트는 React가 처리하도록 차단하지 않음
          return;
        }
        
        // 다이얼로그 내부의 다른 요소(div 등)에서 발생한 이벤트는 전파 차단
        // 하지만 React 이벤트는 정상 실행되도록 preventDefault는 호출하지 않음
        e.stopPropagation();
        return; // 다이얼로그 내부 이벤트는 허용
      }

      // 다이얼로그 외부에서 발생한 핫키 차단
      const shouldBlock = hotkeysToBlock.some(hotkey => {
        const keyLower = hotkey.toLowerCase();
        const eventKeyLower = e.key.toLowerCase();
        
        // Ctrl 키 조합 체크 (f, F, z, Z)
        if ((keyLower === 'f' || keyLower === 'z') && e.ctrlKey) {
          return eventKeyLower === keyLower;
        }
        
        // Ctrl + Plus/Minus 체크
        if ((keyLower === '+' || keyLower === '=' || keyLower === '-') && e.ctrlKey) {
          return eventKeyLower === '+' || eventKeyLower === '=' || eventKeyLower === '-';
        }
        
        // 단일 키 체크 (modifier 키 없을 때만)
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          return eventKeyLower === keyLower;
        }
        
        return false;
      });

      if (shouldBlock) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [dialogSelector, allowArrowKeysInInput, blockedHotkeys]);
}
