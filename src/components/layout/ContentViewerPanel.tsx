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
  fileExplorerRef: React.RefObject<any>;
  textEditorConfig: TextEditorConfig;
  fileViewerState: { isEditing: boolean; hasChanges: boolean };
  showNewFileDialog: boolean;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onSelectPreviousFile: () => void;
  onSelectNextFile: () => void;
  onDeselectFile: () => void;
  onEditStateChange: (state: { isEditing: boolean; hasChanges: boolean }) => void;
  onEditModeEntered: () => void;
  onRenameRequest: (filePath: string) => void;
  onFileDeleted: () => void;
  onFocusExplorer: () => void;
}

export default function ContentViewerPanel({
  tabs,
  activeTabId,
  selectedFilePath,
  newlyCreatedFilePath,
  fileContentViewerRef,
  fileExplorerRef,
  textEditorConfig,
  fileViewerState,
  showNewFileDialog,
  onTabClick,
  onTabClose,
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

