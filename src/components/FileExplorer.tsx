import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { FileSystemItem } from '../types/electron';
import { isHotkey } from '../config/hotkeys';
import { undoService } from '../services/undoService';
import { isTextFile } from '../utils/fileUtils';
import { toastService } from '../services/toastService';
import { usePerformanceMeasure } from '../utils/usePerformanceMeasure';
import ContextMenu from './ContextMenu';

interface FileExplorerProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string | null;
  onFileCreated?: (filePath: string, isDirectory: boolean) => void;
  onFileDeleted?: (filePath: string) => void;
  isDialogOpen?: boolean;
  hideNonTextFiles?: boolean;
  isEditing?: boolean;
}

export interface FileExplorerRef {
  focus: () => void;
  refresh: () => void;
  startRenameForPath: (filePath: string) => void;
}

interface TreeNode extends FileSystemItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

const FileExplorer = forwardRef<FileExplorerRef, FileExplorerProps>(
  ({ currentPath, onFileSelect, selectedFilePath, onFileDeleted, isDialogOpen = false, hideNonTextFiles = false, isEditing = false }, ref) => {
  usePerformanceMeasure('FileExplorer');
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());
  const [cursorPath, setCursorPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ item: FileSystemItem; path: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem | null; path: string | null; isBlankSpace?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; isDirectory: boolean; isCut: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  // 루트 경로 가져오기 (SelectPath로 지정한 경로)
  const getRootPath = useCallback(async (): Promise<string | null> => {
    try {
      if (!window.api?.filesystem) return null;
      // getCurrentDirectory는 SelectPath로 지정한 경로를 반환
      const rootPath = await window.api.filesystem.getCurrentDirectory();
      return rootPath || currentPath;
    } catch {
      return currentPath;
    }
  }, [currentPath]);

  // 디렉토리 로드
  const loadDirectory = useCallback(async (dirPath: string): Promise<FileSystemItem[]> => {
    try {
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return [];
      }
      
      const directoryItems = await window.api.filesystem.listDirectory(dirPath);
      
      // 텍스트 파일이 아닌 파일 필터링 (옵션이 켜져있을 때)
      const filteredItems = hideNonTextFiles
        ? directoryItems.filter(item => item.isDirectory || isTextFile(item.path))
        : directoryItems;
      
      return filteredItems;
    } catch (error) {
      console.error('Error loading directory:', error);
      return [];
    }
  }, [hideNonTextFiles]);

  // 트리 데이터 초기화
  const initializeTree = useCallback(async () => {
    try {
      setLoading(true);
      const rootPath = await getRootPath();
      if (!rootPath) return;

      const items = await loadDirectory(rootPath);
      const rootNodes: TreeNode[] = items.map(item => ({
        ...item,
        isExpanded: false,
        isLoading: false,
      }));

      setTreeData(rootNodes);
      setLoadedPaths(new Set([rootPath]));
    } catch (error) {
      console.error('Error initializing tree:', error);
    } finally {
      setLoading(false);
    }
  }, [getRootPath, loadDirectory]);

  useEffect(() => {
    initializeTree();
  }, [initializeTree]);

  // 특정 경로의 하위 항목 로드
  const loadChildren = useCallback(async (parentPath: string): Promise<TreeNode[]> => {
    const items = await loadDirectory(parentPath);
    return items.map(item => ({
      ...item,
      isExpanded: false,
      isLoading: false,
    }));
  }, [loadDirectory]);

  // 트리에서 노드 찾기
  const findNodeInTree = useCallback((nodes: TreeNode[], targetPath: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) {
        return node;
      }
      if (node.children) {
        const found = findNodeInTree(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // 트리 업데이트 (재귀)
  const updateTreeNode = useCallback((nodes: TreeNode[], targetPath: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return updater(node);
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNode(node.children, targetPath, updater),
        };
      }
      return node;
    });
  }, []);

  // 폴더 확장/축소
  const toggleExpand = useCallback(async (nodePath: string) => {
    const isExpanded = expandedPaths.has(nodePath);
    
    if (isExpanded) {
      // 축소
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(nodePath);
        return next;
      });
    } else {
      // 확장
      setExpandedPaths(prev => new Set(prev).add(nodePath));
      
      // 하위 항목이 아직 로드되지 않았으면 로드
      if (!loadedPaths.has(nodePath)) {
        setTreeData(prev => updateTreeNode(prev, nodePath, node => ({ ...node, isLoading: true })));
        
        const children = await loadChildren(nodePath);
        
        setTreeData(prev => updateTreeNode(prev, nodePath, node => ({
          ...node,
          children,
          isLoading: false,
        })));
        
        setLoadedPaths(prev => new Set(prev).add(nodePath));
      }
    }
  }, [expandedPaths, loadedPaths, loadChildren, updateTreeNode]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (listRef.current) {
        listRef.current.focus();
      }
    },
    refresh: () => {
      initializeTree();
    },
    startRenameForPath: (filePath: string) => {
      setRenamingPath(filePath);
      const node = findNodeInTree(treeData, filePath);
      if (node) {
        setRenamingName(node.name);
      }
    },
  }), [initializeTree, findNodeInTree, treeData]);

  // 트리 노드 렌더링 (재귀)
  const renderTreeNode = useCallback((node: TreeNode, depth: number = 0, flatIndex: { current: number } = { current: 0 }): JSX.Element | null => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = cursorPath === node.path;
    const isRenaming = renamingPath === node.path;
    flatIndex.current++;

    const handleNodeClick = async () => {
      if (renamingPath) return;
      setCursorPath(node.path);
      
      if (node.isDirectory) {
        await toggleExpand(node.path);
      } else if (onFileSelect) {
        onFileSelect(node.path);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item: node, path: node.path, isBlankSpace: false });
    };

    return (
      <div key={node.path}>
        <div
          ref={(el) => {
            if (el) {
              itemRefs.current.set(node.path, el);
            } else {
              itemRefs.current.delete(node.path);
            }
          }}
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
                ref={renamingPath === node.path ? renameInputRef : null}
                type="text"
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameConfirm();
                  } else if (e.key === 'Escape' || e.key === 'Esc') {
                    e.preventDefault();
                    handleRenameCancel();
                  }
                  e.stopPropagation();
                }}
                onBlur={handleRenameConfirm}
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
            {node.children.map(child => renderTreeNode(child, depth + 1, flatIndex))}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, cursorPath, renamingPath, renamingName, toggleExpand, onFileSelect]);

  // 평면화된 노드 리스트 생성 (키보드 네비게이션용)
  const flattenTree = useCallback((nodes: TreeNode[], result: TreeNode[] = []): TreeNode[] => {
    for (const node of nodes) {
      result.push(node);
      if (node.isDirectory && expandedPaths.has(node.path) && node.children) {
        flattenTree(node.children, result);
      }
    }
    return result;
  }, [expandedPaths]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (loading) return;
    
    if (isDialogOpen || isEditing || renamingPath) {
      if (renamingPath) {
        if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Esc') {
          return;
        }
      } else {
        return;
      }
    }
    
    if (showDeleteDialog) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const flatNodes = flattenTree(treeData);
    const currentIndex = cursorPath ? flatNodes.findIndex(n => n.path === cursorPath) : -1;

    if (isHotkey(e.key, 'moveUp')) {
      e.preventDefault();
      if (currentIndex > 0) {
        setCursorPath(flatNodes[currentIndex - 1].path);
      }
    } else if (isHotkey(e.key, 'moveDown')) {
      e.preventDefault();
      if (currentIndex < flatNodes.length - 1) {
        setCursorPath(flatNodes[currentIndex + 1].path);
      }
    } else if (isHotkey(e.key, 'enter') || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      if (renamingPath) {
        handleRenameConfirm();
      } else if (cursorPath) {
        const node = flatNodes.find(n => n.path === cursorPath);
        if (node) {
          if (node.isDirectory) {
            toggleExpand(node.path);
          } else if (onFileSelect) {
            onFileSelect(node.path);
          }
        }
      }
    } else if (isHotkey(e.key, 'goBack')) {
      e.preventDefault();
      if (renamingPath) {
        handleRenameCancel();
      } else if (cursorPath) {
        const node = flatNodes.find(n => n.path === cursorPath);
        if (node?.isDirectory && expandedPaths.has(node.path)) {
          toggleExpand(node.path);
        }
      }
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      if (cursorPath) {
        const node = flatNodes.find(n => n.path === cursorPath);
        if (node) {
          setRenamingPath(node.path);
          setRenamingName(node.name);
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Del') {
      e.preventDefault();
      if (cursorPath) {
        const node = flatNodes.find(n => n.path === cursorPath);
        if (node) {
          setShowDeleteDialog({ item: node, path: node.path });
        }
      }
    }
  };

  const handleRenameConfirm = async () => {
    if (!renamingPath || !renamingName.trim()) {
      setRenamingPath(null);
      setRenamingName('');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const node = findNodeInTree(treeData, renamingPath);
      if (!node) return;

      const oldName = node.name;
      const oldPath = node.path;
      await window.api.filesystem.renameFile(node.path, renamingName.trim());
      
      undoService.addAction({
        type: 'rename',
        path: node.path.replace(oldName, renamingName.trim()),
        oldPath: oldPath,
        newName: renamingName.trim(),
        isDirectory: node.isDirectory,
      });
      
      // 트리 업데이트
      setTreeData(prev => updateTreeNode(prev, renamingPath, node => ({
        ...node,
        name: renamingName.trim(),
        path: node.path.replace(oldName, renamingName.trim()),
      })));
      
      setRenamingPath(null);
      setRenamingName('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '이름 변경 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error renaming file:', err);
    }
  };

  const handleRenameCancel = () => {
    setRenamingPath(null);
    setRenamingName('');
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteDialog) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const { item } = showDeleteDialog;
      
      let content = '';
      if (!item.isDirectory && window.api?.filesystem?.readFile) {
        try {
          const fileContent = await window.api.filesystem.readFile(item.path);
          content = fileContent || '';
        } catch (err) {
          console.error('Error reading file for undo:', err);
        }
      }
      
      undoService.addAction({
        type: 'delete',
        path: item.path,
        isDirectory: item.isDirectory,
        content: content,
      });
      
      if (item.isDirectory) {
        await window.api.filesystem.deleteDirectory(item.path);
      } else {
        await window.api.filesystem.deleteFile(item.path);
      }

      setShowDeleteDialog(null);
      
      // 파일 삭제 시 탭 제거 및 선택 해제
      if (!item.isDirectory) {
        if (onFileDeleted) {
          onFileDeleted(item.path);
        }
        if (onFileSelect && selectedFilePath === item.path) {
          onFileSelect('');
        }
        // 커서 경로도 해제
        if (cursorPath === item.path) {
          setCursorPath(null);
        }
        // 포커스 복귀
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.focus();
          }
        }, 100);
      }
      
      // 트리에서 노드 제거
      const removeNode = (nodes: TreeNode[], targetPath: string): TreeNode[] => {
        return nodes.filter(node => {
          if (node.path === targetPath) {
            return false;
          }
          if (node.children) {
            node.children = removeNode(node.children, targetPath);
          }
          return true;
        });
      };
      
      setTreeData(prev => removeNode(prev, item.path));
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(item.path);
        return next;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error deleting file:', err);
    }
  };

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  useEffect(() => {
    if (selectedFilePath) {
      setCursorPath(selectedFilePath);
    }
  }, [selectedFilePath]);

  useEffect(() => {
    if (cursorPath && itemRefs.current.has(cursorPath)) {
      const element = itemRefs.current.get(cursorPath);
      if (element && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
          element.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
          });
        }
      }
    }
  }, [cursorPath]);

  const handleBlankSpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: null, path: null, isBlankSpace: true });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleCut = async () => {
    if (!contextMenu || !contextMenu.item) return;
    const { item } = contextMenu;
    setClipboard({ path: item.path, isDirectory: item.isDirectory, isCut: true });
    setContextMenu(null);
  };

  const handleCopy = async () => {
    if (!contextMenu || !contextMenu.item) return;
    const { item } = contextMenu;
    if (!item.isDirectory) {
      setClipboard({ path: item.path, isDirectory: false, isCut: false });
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    if (!clipboard || !window.api?.filesystem) return;

    try {
      const sourcePath = clipboard.path;
      const separator = sourcePath.includes('\\') ? '\\' : '/';
      const sourceName = sourcePath.split(separator).pop() || '';
      const pathSeparator = currentPath.includes('\\') ? '\\' : '/';
      const destPath = `${currentPath}${pathSeparator}${sourceName}`;

      if (sourcePath === destPath) {
        toastService.warning('같은 위치에는 붙여넣을 수 없습니다.');
        return;
      }

      const items = await window.api.filesystem.listDirectory(currentPath);
      const exists = items.some(item => item.name === sourceName);
      
      if (exists) {
        toastService.warning('같은 이름의 파일 또는 폴더가 이미 존재합니다.');
        return;
      }

      if (clipboard.isCut) {
        await window.api.filesystem.moveFile(sourcePath, destPath);
        // move는 undoService에 저장하지 않음 (UndoActionType에 없음)

        if (onFileSelect && selectedFilePath === sourcePath) {
          onFileSelect('');
        }
      } else {
        if (!clipboard.isDirectory) {
          await window.api.filesystem.copyFile(sourcePath, destPath);
          // copy는 undoService에 저장하지 않음 (UndoActionType에 없음)
        }
      }

      if (clipboard.isCut) {
        setClipboard(null);
      }

      initializeTree();
      toastService.success(clipboard.isCut ? '이동됨' : '복사됨');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '붙여넣기 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error pasting file:', err);
    }
  };

  const handleContextMenuDelete = () => {
    if (!contextMenu || !contextMenu.item || !contextMenu.path) return;
    const { item, path } = contextMenu;
    setShowDeleteDialog({ item, path });
    setContextMenu(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div
      data-file-explorer
      className="flex flex-col h-full w-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={listRef}
    >
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-1 overflow-y-auto flex-1"
        onContextMenu={handleBlankSpaceContextMenu}
      >
        {treeData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            폴더가 비어있습니다
          </div>
        ) : (
          treeData.map(node => renderTreeNode(node))
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleContextMenuClose}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDelete={handleContextMenuDelete}
          canCopy={contextMenu.item ? !contextMenu.item.isDirectory : false}
          canPaste={clipboard !== null}
          isBlankSpace={contextMenu.isBlankSpace || false}
        />
      )}
      {showDeleteDialog && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div 
            ref={deleteDialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            onKeyDown={(e) => {
              e.stopPropagation();
              
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleDeleteConfirm();
              } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                setShowDeleteDialog(null);
              }
            }}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">삭제 확인</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {showDeleteDialog.item.name}을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소 (Esc)
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
              >
                삭제 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';

export default FileExplorer;
