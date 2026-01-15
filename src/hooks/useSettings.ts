import { useState, useEffect, useCallback } from 'react';
import { loadTextEditorConfig, saveTextEditorConfig, type TextEditorConfig } from '../services/textEditorConfigService';
import { loadSystemConfig, saveSystemConfig, type SystemConfig } from '../services/systemConfigService';
import { applyTheme } from '../services/themeService';
import { isTextFile } from '../utils/fileUtils';
import type { FileExplorerRef } from '../components/FileExplorer';

/**
 * 설정 관리 커스텀 훅
 * 
 * @param fileExplorerRef FileExplorer ref (설정 변경 시 새로고침용)
 * @param selectedFilePath 선택된 파일 경로 (hideNonTextFiles 변경 시 검증용)
 * @param setSelectedFilePath 선택된 파일 경로 설정 함수
 */
export function useSettings(
  fileExplorerRef: React.RefObject<FileExplorerRef>,
  selectedFilePath: string | null,
  setSelectedFilePath: (path: string | null) => void
) {
  const [textEditorConfig, setTextEditorConfig] = useState<TextEditorConfig>({ horizontalPadding: 80, fontSize: 14, textAlign: 'left' });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ hideNonTextFiles: false, theme: 'light', showHelp: false });

  // 초기 설정 로드
  useEffect(() => {
    loadTextEditorConfig().then(setTextEditorConfig);
    loadSystemConfig().then(async (config) => {
      setSystemConfig(config);
      // 초기 테마 적용
      applyTheme(config.theme);
      // 초기 윈도우 테마 설정
      window.dispatchEvent(new CustomEvent('theme:change', { detail: config.theme }));
      // 초기 메뉴바 체크박스 상태 설정
      if (window.api?.menu) {
        try {
          await window.api.menu.updateCheckbox('hideNonTextFiles', config.hideNonTextFiles);
          await window.api.menu.updateCheckbox('showHelp', config.showHelp);
        } catch (err) {
          console.error('Error updating menu checkbox:', err);
        }
      }
    });
  }, []);

  // 텍스트 에디터 설정 변경
  const handleConfigChange = useCallback(async (updates: Partial<TextEditorConfig>) => {
    const newConfig = { ...textEditorConfig, ...updates };
    setTextEditorConfig(newConfig);
    await saveTextEditorConfig(newConfig);
    // saveTextEditorConfig에서 이미 메뉴 업데이트를 호출함
  }, [textEditorConfig]);

  // 시스템 설정 변경
  const handleSystemConfigChange = useCallback(async (updates: Partial<SystemConfig>) => {
    const newConfig = { ...systemConfig, ...updates };
    setSystemConfig(newConfig);
    await saveSystemConfig(newConfig);
    
    // 테마 적용
    if (updates.theme !== undefined) {
      applyTheme(updates.theme);
      // 메인 프로세스에 테마 변경 알림
      if (window.api?.filesystem) {
        // IPC를 통해 테마 변경 알림 (preload를 통해)
        window.dispatchEvent(new CustomEvent('theme:change', { detail: updates.theme }));
      }
    }
    
    // 메뉴바 체크박스 상태 업데이트
    if (window.api?.menu) {
      try {
        if (updates.hideNonTextFiles !== undefined) {
          await window.api.menu.updateCheckbox('hideNonTextFiles', updates.hideNonTextFiles);
        }
        if (updates.showHelp !== undefined) {
          await window.api.menu.updateCheckbox('showHelp', updates.showHelp);
        }
      } catch (err) {
        console.error('Error updating menu checkbox:', err);
      }
    }
    
    // "텍스트 파일만 표시" 옵션이 켜질 때, 현재 선택된 파일이 텍스트 파일이 아니면 선택 해제
    if (updates.hideNonTextFiles === true && selectedFilePath && !isTextFile(selectedFilePath)) {
      setSelectedFilePath(null);
    }
    
    // 설정 변경 시 FileExplorer 새로고침
    if (fileExplorerRef.current) {
      fileExplorerRef.current.refresh();
    }
  }, [systemConfig, selectedFilePath, setSelectedFilePath, fileExplorerRef]);

  return {
    textEditorConfig,
    systemConfig,
    handleConfigChange,
    handleSystemConfigChange,
  };
}

