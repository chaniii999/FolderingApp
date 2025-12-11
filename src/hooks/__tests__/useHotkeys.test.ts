import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from '../useHotkeys';

describe('useHotkeys', () => {
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('핫키가 등록되고 작동해야 함', () => {
    const hotkeys = [
      {
        key: 'n',
        handler: mockHandler,
      },
    ];

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => false, // shouldBlockHotkey
        () => false // isInputElement
      )
    );

    // 키보드 이벤트 시뮬레이션
    const event = new KeyboardEvent('keydown', { key: 'n' });
    window.dispatchEvent(event);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('shouldBlockHotkey가 true일 때 핫키가 작동하지 않아야 함', () => {
    const hotkeys = [
      {
        key: 'n',
        handler: mockHandler,
      },
    ];

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => true, // shouldBlockHotkey = true
        () => false
      )
    );

    const event = new KeyboardEvent('keydown', { key: 'n' });
    window.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('입력 요소에서 핫키가 작동하지 않아야 함', () => {
    const hotkeys = [
      {
        key: 'n',
        handler: mockHandler,
      },
    ];

    // textarea 요소 생성
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => false,
        (target) => target === textarea // isInputElement
      )
    );

    const event = new KeyboardEvent('keydown', { key: 'n' });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    window.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('Ctrl 키와 함께 눌렀을 때 핫키가 작동해야 함', () => {
    const hotkeys = [
      {
        key: 'z',
        ctrl: true,
        handler: mockHandler,
      },
    ];

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => false,
        () => false
      )
    );

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    window.dispatchEvent(event);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('Ctrl 키 없이 눌렀을 때 핫키가 작동하지 않아야 함', () => {
    const hotkeys = [
      {
        key: 'z',
        ctrl: true,
        handler: mockHandler,
      },
    ];

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => false,
        () => false
      )
    );

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: false });
    window.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('allowInInput이 true일 때 입력 요소에서도 핫키가 작동해야 함', () => {
    const hotkeys = [
      {
        key: 'n',
        allowInInput: true,
        handler: mockHandler,
      },
    ];

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    renderHook(() =>
      useHotkeys(
        hotkeys,
        () => false,
        (target) => target === textarea
      )
    );

    const event = new KeyboardEvent('keydown', { key: 'n' });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    window.dispatchEvent(event);

    expect(mockHandler).toHaveBeenCalledTimes(1);

    document.body.removeChild(textarea);
  });
});

