import { memo } from 'react';
import TabBar from '../TabBar';
import FileContentViewer, { type FileContentViewerRef } from '../FileContentViewer';
import type { Tab } from '../../types/tabs';
import type { TextEditorConfig } from '../../services/textEditorConfigService';

interface ContentViewerPanelProps {
  tabs: Tab[];
  activeTabId: string | null;
  selectedFilePath: string | null;
  newlyCreatedFilePath: string | null;
  fileContentViewerRef: React.RefObject<FileContentViewerRef>;
  textEditorConfig: TextEditorConfig;
  showNewFileDialog: boolean;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseOthers: (tabId: string) => void;
  onTabCloseToRight: (tabId: string) => void;
  onTabCloseSaved: () => void;
  onTabCloseAll: () => void;
  onSelectPreviousFile: () => void;
  onSelectNextFile: () => void;
  onDeselectFile: () => void;
  onEditStateChange: (state: { isEditing: boolean; hasChanges: boolean }) => void;
  onEditModeEntered: () => void;
  onRenameRequest: (filePath: string) => void;
  onFileDeleted: (filePath: string) => void;
  onFocusExplorer: () => void;
}

function ContentViewerPanel({
  tabs,
  activeTabId,
  selectedFilePath,
  newlyCreatedFilePath,
  fileContentViewerRef,
  textEditorConfig,
  showNewFileDialog,
  onTabClick,
  onTabClose,
  onTabCloseOthers,
  onTabCloseToRight,
  onTabCloseSaved,
  onTabCloseAll,
  onSelectPreviousFile,
  onSelectNextFile,
  onDeselectFile,
  onEditStateChange,
  onEditModeEntered,
  onRenameRequest,
  onFileDeleted,
  onFocusExplorer,
}: ContentViewerPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onTabCloseOthers={onTabCloseOthers}
          onTabCloseToRight={onTabCloseToRight}
          onTabCloseSaved={onTabCloseSaved}
          onTabCloseAll={onTabCloseAll}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <FileContentViewer 
          ref={fileContentViewerRef}
          filePath={selectedFilePath}
          onSelectPreviousFile={onSelectPreviousFile}
          onSelectNextFile={onSelectNextFile}
          onDeselectFile={onDeselectFile}
          textEditorConfig={textEditorConfig}
          autoEdit={newlyCreatedFilePath === selectedFilePath}
          onEditModeEntered={onEditModeEntered}
          onEditModeChange={() => {
            // 상태는 onEditStateChange에서 추적
          }}
          onEditStateChange={onEditStateChange}
          onRenameRequest={onRenameRequest}
          onFileDeleted={onFileDeleted}
          isDialogOpen={showNewFileDialog}
          onFocusExplorer={onFocusExplorer}
        />
      </div>
    </div>
  );
}

export default memo(ContentViewerPanel);

