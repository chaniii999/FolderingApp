import { useEffect } from 'react';

/**
 * 핫키 설정 인터페이스
 */
export interface HotkeyConfig {
  /** 키 (예: 'n', 'b', 'z') */
  key: string;
  /** Ctrl 키 필요 여부 */
  ctrl?: boolean;
  /** Alt 키 필요 여부 */
  alt?: boolean;
  /** Meta 키 필요 여부 (Mac의 Cmd) */
  meta?: boolean;
  /** Shift 키 필요 여부 */
  shift?: boolean;
  /** 핫키가 작동하지 않아야 할 상황 체크 함수 */
  shouldBlock?: () => boolean;
  /** 입력 요소에서도 작동할지 여부 (기본: false) */
  allowInInput?: boolean;
  /** 핫키 핸들러 */
  handler: (e: KeyboardEvent) => void;
}

/**
 * 핫키 관리 커스텀 훅
 * 
 * @param hotkeys 핫키 설정 배열
 * @param shouldBlockHotkey 핫키가 작동하지 않아야 할 상황 체크 함수
 * @param isInputElement 입력 요소인지 확인하는 함수
 */
export function useHotkeys(
  hotkeys: HotkeyConfig[],
  shouldBlockHotkey: () => boolean,
  isInputElement: (target: EventTarget | null) => boolean
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 핫키가 작동하지 않아야 할 상황에서는 아예 처리하지 않음
      if (shouldBlockHotkey()) {
        return;
      }

      // 각 핫키 설정 확인
      for (const hotkey of hotkeys) {
        const keyMatch = 
          e.key === hotkey.key || 
          e.key === hotkey.key.toUpperCase() ||
          e.key === hotkey.key.toLowerCase();

        if (!keyMatch) continue;

        // 입력 요소 체크
        if (!hotkey.allowInInput && isInputElement(e.target)) {
          continue;
        }

        // 개별 핫키의 shouldBlock 체크
        if (hotkey.shouldBlock && hotkey.shouldBlock()) {
          continue;
        }

        // Modifier 키 체크
        const ctrlMatch = hotkey.ctrl === undefined ? true : (hotkey.ctrl === e.ctrlKey);
        const altMatch = hotkey.alt === undefined ? true : (hotkey.alt === e.altKey);
        const metaMatch = hotkey.meta === undefined ? true : (hotkey.meta === e.metaKey);
        const shiftMatch = hotkey.shift === undefined ? true : (hotkey.shift === e.shiftKey);

        // 다른 modifier 키가 눌려있지 않은지 확인
        // 예: ctrl이 필요하면 ctrl만 눌려있어야 하고, 필요없으면 ctrl이 없어야 함
        const noExtraModifiers = 
          (hotkey.ctrl === undefined ? !e.ctrlKey : true) &&
          (hotkey.alt === undefined ? !e.altKey : true) &&
          (hotkey.meta === undefined ? !e.metaKey : true) &&
          (hotkey.shift === undefined ? !e.shiftKey : true);

        if (ctrlMatch && altMatch && metaMatch && shiftMatch && noExtraModifiers) {
          e.preventDefault();
          e.stopPropagation();
          hotkey.handler(e);
          return; // 첫 번째 매칭되는 핫키만 실행
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeys, shouldBlockHotkey, isInputElement]);
}

