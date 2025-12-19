import { useCallback } from 'react';
import type { FileSystemItem } from '../../types/electron';

interface TreeNode extends FileSystemItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  renamingName: string;
  onNodeClick: (nodePath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRenameChange: (name: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  itemRef: (el: HTMLDivElement | null, path: string) => void;
}

/**
 * 트리 노드 컴포넌트
 */
export default function TreeNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  renamingName,
  onNodeClick,
  onContextMenu,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  renameInputRef,
  itemRef,
}: TreeNodeProps) {
  const handleNodeClick = useCallback(() => {
    onNodeClick(node.path);
  }, [node.path, onNodeClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, node);
  }, [node, onContextMenu]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onRenameConfirm();
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      onRenameCancel();
    }
    e.stopPropagation();
  }, [onRenameConfirm, onRenameCancel]);

  return (
    <div>
      <div
        ref={(el) => itemRef(el, node.path)}
        className={`flex items-center gap-2 px-2 py-1 cursor-pointer ${
          isSelected
            ? 'bg-blue-500 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
      >
        <div className="w-4 flex items-center justify-center">
          {isSelected && <span className="text-sm">▶</span>}
        </div>
        {node.isDirectory && (
          <div className="w-4 flex items-center justify-center">
            {node.isLoading ? (
              <span className="text-xs">⏳</span>
            ) : isExpanded ? (
              <span className="text-xs">▼</span>
            ) : (
              <span className="text-xs">▶</span>
            )}
          </div>
        )}
        {!node.isDirectory && <div className="w-4" />}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm">{node.isDirectory ? '📁' : '📄'}</span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingName}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={onRenameConfirm}
              className="flex-1 px-1 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-sm">{node.name}</span>
          )}
        </div>
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isExpanded={false}
              isSelected={false}
              isRenaming={false}
              renamingName=""
              onNodeClick={onNodeClick}
              onContextMenu={onContextMenu}
              onRenameChange={onRenameChange}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              renameInputRef={renameInputRef}
              itemRef={itemRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

