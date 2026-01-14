import { useState, useRef, useCallback } from 'react';
import type { Tab } from '../types/tabs';
import type { FileContentViewerRef } from '../components/FileContentViewer';
import { getFileName } from '../utils/pathUtils';
import { handleError } from '../utils/errorHandler';

/**
 * 탭 관리 커스텀 훅
 * 
 * @param setSelectedFilePath 선택된 파일 경로를 설정하는 함수
 * @param setFileViewerState 파일 뷰어 상태를 설정하는 함수
 * @param fileContentViewerRef 파일 콘텐츠 뷰어 ref
 */
export function useTabs(
  setSelectedFilePath: (path: string | null) => void,
  setFileViewerState: (state: { isEditing: boolean; hasChanges: boolean }) => void,
  fileContentViewerRef: React.RefObject<FileContentViewerRef>
) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabStateRef = useRef<Map<string, { isEditing: boolean; hasChanges: boolean }>>(new Map());
  const [pendingTabClose, setPendingTabClose] = useState<{ tabId: string; fileName: string } | null>(null);

  // 탭 상태 업데이트 (외부에서 호출)
  const updateTabState = useCallback((tabId: string | null, state: { isEditing: boolean; hasChanges: boolean }) => {
    if (tabId) {
      tabStateRef.current.set(tabId, state);
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, isEditing: state.isEditing, hasChanges: state.hasChanges }
          : tab
      ));
    }
  }, []);

  // 탭 추가 또는 전환
  const addOrSwitchTab = useCallback((filePath: string) => {
    const fileName = getFileName(filePath);
    const tabId = filePath;
    
    setTabs(prevTabs => {
      // 이미 열려있는 탭인지 확인 (중복 방지)
      const existingTab = prevTabs.find(tab => tab.id === tabId);
      if (existingTab) {
        // 이미 열려있으면 해당 탭으로 전환
        setActiveTabId(tabId);
        setSelectedFilePath(filePath);
        // 저장된 상태 복원
        const savedState = tabStateRef.current.get(tabId);
        if (savedState) {
          setFileViewerState(savedState);
        } else {
          setFileViewerState({ isEditing: false, hasChanges: false });
        }
        return prevTabs;
      }
      
      // 중복된 탭이 있는지 확인 (filePath 기준, 안전장치)
      const duplicateTabs = prevTabs.filter(tab => tab.filePath === filePath);
      if (duplicateTabs.length > 0) {
        // 중복된 탭이 있으면 첫 번째 탭으로 전환하고 나머지 제거
        const firstDuplicate = duplicateTabs[0];
        const filteredTabs = prevTabs.filter(tab => tab.filePath !== filePath || tab.id === firstDuplicate.id);
        
        // 제거된 탭들의 상태 정리
        duplicateTabs.slice(1).forEach(tab => {
          tabStateRef.current.delete(tab.id);
        });
        
        setTabs(filteredTabs);
        setActiveTabId(firstDuplicate.id);
        setSelectedFilePath(filePath);
        const savedState = tabStateRef.current.get(firstDuplicate.id);
        if (savedState) {
          setFileViewerState(savedState);
        } else {
          setFileViewerState({ isEditing: false, hasChanges: false });
        }
        return filteredTabs;
      }
      
      // 새 탭 추가
      const newTab: Tab = {
        id: tabId,
        filePath,
        fileName,
        isEditing: false,
        hasChanges: false,
      };
      
      setActiveTabId(tabId);
      setSelectedFilePath(filePath);
      tabStateRef.current.set(tabId, { isEditing: false, hasChanges: false });
      return [...prevTabs, newTab];
    });
  }, [setSelectedFilePath, setFileViewerState]);

  // 탭 전환
  const handleTabClick = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      setSelectedFilePath(tab.filePath);
      // 저장된 상태 복원
      const savedState = tabStateRef.current.get(tabId);
      if (savedState) {
        setFileViewerState(savedState);
      } else {
        setFileViewerState({ isEditing: false, hasChanges: false });
      }
    }
  }, [tabs, setSelectedFilePath, setFileViewerState]);

  // 실제 탭 닫기 로직
  const closeTabInternal = useCallback((tabId: string) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    tabStateRef.current.delete(tabId);
    
    // 닫은 탭이 활성 탭이었으면 다른 탭으로 전환
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // 닫은 탭의 이전 탭으로 전환 (없으면 다음 탭)
        const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
        setActiveTabId(newActiveTab.id);
        setSelectedFilePath(newActiveTab.filePath);
        const savedState = tabStateRef.current.get(newActiveTab.id);
        if (savedState) {
          setFileViewerState(savedState);
        } else {
          setFileViewerState({ isEditing: false, hasChanges: false });
        }
      } else {
        // 모든 탭이 닫혔으면
        setActiveTabId(null);
        setSelectedFilePath(null);
        setFileViewerState({ isEditing: false, hasChanges: false });
      }
    }
  }, [tabs, activeTabId, setSelectedFilePath, setFileViewerState]);

  // 탭 닫기
  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // 편집 중이거나 변경사항이 있으면 확인 다이얼로그 표시
    const tabState = tabStateRef.current.get(tabId);
    if (tabState?.isEditing || tabState?.hasChanges) {
      setPendingTabClose({ tabId, fileName: tab.fileName });
      return;
    }
    
    // 변경사항이 없으면 바로 닫기
    closeTabInternal(tabId);
  }, [tabs, closeTabInternal]);

  // 저장 확인 다이얼로그에서 저장 선택
  const handleSaveAndClose = useCallback(async () => {
    if (!pendingTabClose) return;
    
    const { tabId } = pendingTabClose;
    const tab = tabs.find(t => t.id === tabId);
    
    // 해당 탭이 활성 탭이면 저장
    if (tab && activeTabId === tabId && fileContentViewerRef.current) {
      try {
        await fileContentViewerRef.current.handleSave();
        // 저장 후 탭 닫기
        closeTabInternal(tabId);
        setPendingTabClose(null);
      } catch (err) {
        handleError(err, '파일 저장 중 오류가 발생했습니다.');
        // 저장 실패 시 다이얼로그는 유지
        return;
      }
    } else {
      // 활성 탭이 아니면 그냥 닫기 (이미 저장된 상태)
      closeTabInternal(tabId);
      setPendingTabClose(null);
    }
  }, [pendingTabClose, tabs, activeTabId, closeTabInternal, fileContentViewerRef]);

  // 저장 확인 다이얼로그에서 저장하지 않고 닫기 선택
  const handleDiscardAndClose = useCallback(() => {
    if (!pendingTabClose) return;
    
    const { tabId } = pendingTabClose;
    
    // 변경사항을 버리고 탭 닫기
    closeTabInternal(tabId);
    setPendingTabClose(null);
  }, [pendingTabClose, closeTabInternal]);

  // 저장 확인 다이얼로그 취소
  const handleCancelClose = useCallback(() => {
    setPendingTabClose(null);
  }, []);

  // 파일 경로로 탭 닫기 (파일 삭제 시 사용)
  const closeTabByFilePath = useCallback((filePath: string) => {
    const tab = tabs.find(t => t.filePath === filePath);
    if (tab) {
      // 변경사항 확인 없이 바로 닫기
      closeTabInternal(tab.id);
    }
  }, [tabs, closeTabInternal]);

  // 현재 활성 탭의 파일만 변경 (화살표 키로 이동할 때 사용)
  const switchCurrentTab = useCallback((filePath: string) => {
    const fileName = getFileName(filePath);
    const tabId = filePath;
    
    // 이미 같은 파일 경로를 가진 탭이 있는지 확인
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      // 이미 같은 파일을 가진 탭이 있으면 해당 탭으로 전환
      setActiveTabId(tabId);
      setSelectedFilePath(filePath);
      const savedState = tabStateRef.current.get(tabId);
      if (savedState) {
        setFileViewerState(savedState);
      } else {
        setFileViewerState({ isEditing: false, hasChanges: false });
      }
      return;
    }
    
    // 활성 탭이 있으면 그 탭의 파일 경로만 변경
    if (activeTabId && tabs.length > 0) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        // 기존 활성 탭의 상태 저장
        const oldState = tabStateRef.current.get(activeTabId);
        
        // 활성 탭의 파일 경로 변경
        setTabs(prevTabs => prevTabs.map(tab => 
          tab.id === activeTabId
            ? { ...tab, id: tabId, filePath, fileName }
            : tab
        ));
        
        // 기존 탭 상태를 새 탭 ID로 이동
        if (oldState) {
          tabStateRef.current.set(tabId, oldState);
          tabStateRef.current.delete(activeTabId);
        } else {
          tabStateRef.current.set(tabId, { isEditing: false, hasChanges: false });
        }
        
        setActiveTabId(tabId);
        setSelectedFilePath(filePath);
        setFileViewerState({ isEditing: false, hasChanges: false });
        return;
      }
    }
    
    // 활성 탭이 없으면 새 탭 추가
    addOrSwitchTab(filePath);
  }, [activeTabId, tabs, setSelectedFilePath, setFileViewerState, addOrSwitchTab]);

  // 탭 상태 저장 (모드별 상태 저장용)
  const getState = useCallback(() => {
    return {
      tabs,
      activeTabId,
      tabStates: new Map(tabStateRef.current),
    };
  }, [tabs, activeTabId]);

  // 탭 상태 복원 (모드별 상태 복원용)
  const setState = useCallback((state: { tabs: Tab[]; activeTabId: string | null; tabStates: Map<string, { isEditing: boolean; hasChanges: boolean }> }) => {
    setTabs(state.tabs);
    setActiveTabId(state.activeTabId);
    tabStateRef.current = new Map(state.tabStates);
    
    // 활성 탭이 있으면 해당 파일 선택 및 상태 복원
    if (state.activeTabId && state.tabs.length > 0) {
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (activeTab) {
        setSelectedFilePath(activeTab.filePath);
        const savedState = state.tabStates.get(state.activeTabId);
        if (savedState) {
          setFileViewerState(savedState);
        } else {
          setFileViewerState({ isEditing: false, hasChanges: false });
        }
      }
    } else {
      setSelectedFilePath(null);
      setFileViewerState({ isEditing: false, hasChanges: false });
    }
  }, [setSelectedFilePath, setFileViewerState]);

  return {
    tabs,
    activeTabId,
    pendingTabClose,
    updateTabState,
    addOrSwitchTab,
    switchCurrentTab,
    handleTabClick,
    handleTabClose,
    handleSaveAndClose,
    handleDiscardAndClose,
    handleCancelClose,
    closeTabByFilePath,
    getState,
    setState,
  };
}

