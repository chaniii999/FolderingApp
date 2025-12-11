import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSettings } from '../useSettings';
import type { FileExplorerRef } from '../../components/FileExplorer';

// 서비스 모킹
vi.mock('../../services/textEditorConfigService', () => ({
  loadTextEditorConfig: vi.fn().mockResolvedValue({ horizontalPadding: 80, fontSize: 14 }),
  saveTextEditorConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/systemConfigService', () => ({
  loadSystemConfig: vi.fn().mockResolvedValue({
    hideNonTextFiles: false,
    theme: 'light',
    showHelp: false,
  }),
  saveSystemConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/themeService', () => ({
  applyTheme: vi.fn(),
  defaultTheme: 'light',
}));

vi.mock('../../utils/fileUtils', () => ({
  isTextFile: vi.fn((path: string) => path.endsWith('.md') || path.endsWith('.txt')),
}));

describe('useSettings', () => {
  const mockFileExplorerRef = {
    current: {
      refresh: vi.fn(),
    } as unknown as FileExplorerRef,
  } as React.RefObject<FileExplorerRef>;

  const mockSetSelectedFilePath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('초기 설정이 올바르게 로드되어야 함', async () => {
    const { result } = renderHook(() =>
      useSettings(mockFileExplorerRef, null, mockSetSelectedFilePath)
    );

    await waitFor(() => {
      expect(result.current.textEditorConfig).toBeDefined();
      expect(result.current.systemConfig).toBeDefined();
    });

    expect(result.current.textEditorConfig.horizontalPadding).toBe(80);
    expect(result.current.textEditorConfig.fontSize).toBe(14);
    expect(result.current.systemConfig.theme).toBe('light');
  });

  it('handleConfigChange로 텍스트 에디터 설정을 변경할 수 있어야 함', async () => {
    const { result } = renderHook(() =>
      useSettings(mockFileExplorerRef, null, mockSetSelectedFilePath)
    );

    await waitFor(() => {
      expect(result.current.textEditorConfig).toBeDefined();
    });

    await act(async () => {
      await result.current.handleConfigChange({ fontSize: 16 });
    });

    expect(result.current.textEditorConfig.fontSize).toBe(16);
  });

  it('handleSystemConfigChange로 시스템 설정을 변경할 수 있어야 함', async () => {
    const { result } = renderHook(() =>
      useSettings(mockFileExplorerRef, null, mockSetSelectedFilePath)
    );

    await waitFor(() => {
      expect(result.current.systemConfig).toBeDefined();
    });

    await act(async () => {
      await result.current.handleSystemConfigChange({ hideNonTextFiles: true });
    });

    expect(result.current.systemConfig.hideNonTextFiles).toBe(true);
  });

  it('hideNonTextFiles가 true일 때 텍스트 파일이 아닌 파일 선택이 해제되어야 함', async () => {
    const { result } = renderHook(() =>
      useSettings(mockFileExplorerRef, '/test/image.png', mockSetSelectedFilePath)
    );

    await waitFor(() => {
      expect(result.current.systemConfig).toBeDefined();
    });

    await act(async () => {
      await result.current.handleSystemConfigChange({ hideNonTextFiles: true });
    });

    expect(mockSetSelectedFilePath).toHaveBeenCalledWith(null);
  });

  it('설정 변경 시 FileExplorer가 새로고침되어야 함', async () => {
    const { result } = renderHook(() =>
      useSettings(mockFileExplorerRef, null, mockSetSelectedFilePath)
    );

    await waitFor(() => {
      expect(result.current.systemConfig).toBeDefined();
    });

    await act(async () => {
      await result.current.handleSystemConfigChange({ showHelp: true });
    });

    expect(mockFileExplorerRef.current?.refresh).toHaveBeenCalled();
  });
});

import { act } from '@testing-library/react';

