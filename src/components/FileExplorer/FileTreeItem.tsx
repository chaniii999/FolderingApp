import React, { memo } from 'react';
import type { FileSystemItem } from '../../types/electron';
import { getFileName, joinPath } from '../../utils/pathUtils';
import { toastService } from '../../services/toastService';
import { handleError } from '../../utils/errorHandler';

interface TreeNode extends FileSystemItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  renamingName: string;
  isMyMemoPath: boolean;
  draggedItem: { path: string; isDirectory: boolean } | null;
  onNodeClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
  onDragOver: (e: React.DragEvent) => void;
  onRenameChange: (name: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  itemRef: (el: HTMLDivElement | null, path: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement> | null;
  renderChildren: (children: TreeNode[], depth: number) => React.ReactNode;
}

const FileTreeItem = memo<FileTreeItemProps>(({
  node,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  renamingName,
  isMyMemoPath,
  draggedItem,
  onNodeClick,
  onContextMenu,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragOver,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  itemRef,
  renameInputRef,
  renderChildren,
}) => {
  return (
    <div>
      <div
        ref={(el) => itemRef(el, node.path)}
        className={`flex items-center gap-2 py-1 cursor-pointer text-left ${
          isSelected
            ? 'bg-blue-500 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        style={{ 
          paddingLeft: `${8 + depth * 16}px` 
        }}
        onClick={onNodeClick}
        onContextMenu={onContextMenu}
        draggable={!isRenaming}
        onDragStart={!isRenaming ? onDragStart : undefined}
        onDragEnter={node.isDirectory ? onDragEnter : undefined}
        onDragLeave={node.isDirectory ? onDragLeave : undefined}
        onDrop={node.isDirectory ? onDrop : undefined}
        onDragOver={node.isDirectory ? onDragOver : undefined}
      >
        <div className="w-4 flex items-center justify-center flex-shrink-0">
          {isSelected && (
            <span className="text-sm">▶</span>
          )}
        </div>
        {node.isDirectory && (() => {
          // 폴더가 비어있으면 화살표 표시하지 않음
          // node.children이 명시적으로 빈 배열([])인 경우만 빈 폴더로 판단
          // undefined인 경우는 아직 로드되지 않았을 수 있으므로 화살표 표시
          const isEmpty = Array.isArray(node.children) && node.children.length === 0;
          if (isEmpty) {
            return <div className="w-4 flex-shrink-0" />;
          }
          return (
            <div className="w-4 flex items-center justify-center flex-shrink-0">
              {node.isLoading ? (
                <span className="text-xs">⏳</span>
              ) : isExpanded ? (
                <span className="text-xs">▼</span>
              ) : (
                <span className="text-xs">▶</span>
              )}
            </div>
          );
        })()}
        {!node.isDirectory && <div className="w-4 flex-shrink-0" />}
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            if (node.isDirectory) {
              return <span className="text-sm flex-shrink-0">📁</span>;
            }
            
            // 템플릿 인스턴스 파일인지 확인 (나만의 메모 경로이고 .json 파일)
            const isTemplateInstance = isMyMemoPath && node.name.toLowerCase().endsWith('.json');
            if (isTemplateInstance) {
              return <span className="text-sm flex-shrink-0">✨</span>;
            }
            
            // 마크다운 파일인지 확인
            const isMarkdown = node.name.toLowerCase().endsWith('.md') || node.name.toLowerCase().endsWith('.markdown');
            if (isMarkdown) {
              return <span className="text-sm flex-shrink-0">📖</span>;
            }
            
            // 일반 파일
            return <span className="text-sm flex-shrink-0">📄</span>;
          })()}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingName}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onRenameConfirm();
                } else if (e.key === 'Escape' || e.key === 'Esc') {
                  e.preventDefault();
                  onRenameCancel();
                }
                e.stopPropagation();
              }}
              onBlur={() => {
                // onBlur는 Enter 키로 이미 처리되었을 수 있으므로
                // 약간의 지연을 두고 확인 (중복 호출 방지)
                // 단, 포커스가 FileExplorer로 이동하는 경우는 제외
                setTimeout(() => {
                  // 포커스가 FileExplorer로 이동했는지 확인
                  const activeElement = document.activeElement;
                  if (activeElement && activeElement.getAttribute('data-file-explorer')) {
                    return; // FileExplorer로 포커스가 이동했으면 확인하지 않음
                  }
                  onRenameConfirm();
                }, 150);
              }}
              className="flex-1 px-1 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (() => {
            // 템플릿 인스턴스 파일이면 확장자 제거
            const isTemplateInstance = isMyMemoPath && !node.isDirectory && node.name.toLowerCase().endsWith('.json');
            const displayName = isTemplateInstance 
              ? node.name.replace(/\.json$/i, '')
              : node.name;
            
            return <span className="truncate text-sm">{displayName}</span>;
          })()}
        </div>
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {renderChildren(node.children, depth + 1)}
        </div>
      )}
    </div>
  );
});

FileTreeItem.displayName = 'FileTreeItem';

export default FileTreeItem;
export type { TreeNode };
