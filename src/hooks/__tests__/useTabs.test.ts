import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabs } from '../useTabs';
import type { FileContentViewerRef } from '../../components/FileContentViewer';

describe('useTabs', () => {
  const mockSetSelectedFilePath = vi.fn();
  const mockSetFileViewerState = vi.fn();
  const mockFileContentViewerRef = {
    current: {
      handleSave: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileContentViewerRef,
  } as React.RefObject<FileContentViewerRef>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
    expect(result.current.pendingTabClose).toBeNull();
  });

  it('addOrSwitchTab으로 새 탭을 추가할 수 있어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].filePath).toBe('/test/file1.md');
    expect(result.current.tabs[0].fileName).toBe('file1.md');
    expect(result.current.activeTabId).toBe('/test/file1.md');
    expect(mockSetSelectedFilePath).toHaveBeenCalledWith('/test/file1.md');
  });

  it('이미 열려있는 탭을 다시 열면 전환되어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
    });

    act(() => {
      result.current.addOrSwitchTab('/test/file2.md');
    });

    expect(result.current.tabs).toHaveLength(2);

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
    });

    // 탭 개수는 그대로
    expect(result.current.tabs).toHaveLength(2);
    // 활성 탭이 file1.md로 변경됨
    expect(result.current.activeTabId).toBe('/test/file1.md');
  });

  it('handleTabClick으로 탭을 전환할 수 있어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
      result.current.addOrSwitchTab('/test/file2.md');
    });

    expect(result.current.activeTabId).toBe('/test/file2.md');

    act(() => {
      result.current.handleTabClick('/test/file1.md');
    });

    expect(result.current.activeTabId).toBe('/test/file1.md');
    expect(mockSetSelectedFilePath).toHaveBeenCalledWith('/test/file1.md');
  });

  it('변경사항이 없는 탭은 바로 닫혀야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
    });

    const mockEvent = {
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleTabClose('/test/file1.md', mockEvent);
    });

    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
  });

  it('변경사항이 있는 탭은 닫기 확인 다이얼로그가 표시되어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
      result.current.updateTabState('/test/file1.md', { isEditing: false, hasChanges: true });
    });

    const mockEvent = {
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleTabClose('/test/file1.md', mockEvent);
    });

    // 탭은 아직 닫히지 않음
    expect(result.current.tabs).toHaveLength(1);
    // pendingTabClose가 설정됨
    expect(result.current.pendingTabClose).not.toBeNull();
    expect(result.current.pendingTabClose?.tabId).toBe('/test/file1.md');
  });

  it('updateTabState로 탭 상태를 업데이트할 수 있어야 함', () => {
    const { result } = renderHook(() =>
      useTabs(mockSetSelectedFilePath, mockSetFileViewerState, mockFileContentViewerRef)
    );

    act(() => {
      result.current.addOrSwitchTab('/test/file1.md');
      result.current.updateTabState('/test/file1.md', { isEditing: true, hasChanges: true });
    });

    const tab = result.current.tabs.find((t) => t.id === '/test/file1.md');
    expect(tab?.isEditing).toBe(true);
    expect(tab?.hasChanges).toBe(true);
  });
});

