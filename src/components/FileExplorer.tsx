import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { FileSystemItem } from '../types/electron';
import { isHotkey } from '../config/hotkeys';
import { undoService } from '../services/undoService';
import { isTextFile } from '../utils/fileUtils';
import { toastService } from '../services/toastService';
import { usePerformanceMeasure } from '../utils/usePerformanceMeasure';
import { getFileName, joinPath } from '../utils/pathUtils';
import { handleError } from '../utils/errorHandler';
import ContextMenu from './ContextMenu';

interface FileExplorerProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string | null;
  onFileCreated?: (filePath: string, isDirectory: boolean) => void;
  onFileDeleted?: (filePath: string) => void;
  onNewFileClick?: () => void;
  isDialogOpen?: boolean;
  hideNonTextFiles?: boolean;
  isEditing?: boolean;
}

export interface FileExplorerRef {
  focus: () => void;
  refresh: () => void;
  refreshFolder: (folderPath: string) => Promise<void>;
  startRenameForPath: (filePath: string) => void;
  getDraggedFolderPath: () => string | null;
  getSelectedFolderPath: () => string | null;
}

interface TreeNode extends FileSystemItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

const FileExplorer = forwardRef<FileExplorerRef, FileExplorerProps>(
  ({ currentPath, onFileSelect, selectedFilePath, onFileDeleted, onNewFileClick, isDialogOpen = false, hideNonTextFiles = false, isEditing = false }, ref) => {
  usePerformanceMeasure('FileExplorer');
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const treeDataRef = useRef<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());
  const [cursorPath, setCursorPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ item: FileSystemItem; path: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem | null; path: string | null; isBlankSpace?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; isDirectory: boolean; isCut: boolean } | null>(null);
  const [draggedFolderPath, setDraggedFolderPath] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ path: string; isDirectory: boolean } | null>(null);
  const [isMyMemoPath, setIsMyMemoPath] = useState<boolean>(false);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const handleRenameConfirmRef = useRef<(() => Promise<void>) | null>(null);
  const handleRenameCancelRef = useRef<(() => void) | null>(null);

  // 루트 경로 가져오기 (SelectPath로 지정한 경로 또는 나만의 메모 경로)
  const getRootPath = useCallback(async (): Promise<string | null> => {
    try {
      if (!window.api?.filesystem) return currentPath || null;
      
      // 나만의 메모 모드인지 확인
      if (window.api?.mymemo && currentPath) {
        const isMyMemo = await window.api.mymemo.isMyMemoPath(currentPath);
        if (isMyMemo) {
          // 나만의 메모 모드면 currentPath를 직접 사용
          return currentPath;
        }
      }
      
      // 일반 모드면 SelectPath로 지정한 경로 사용
      const rootPath = await window.api.filesystem.getCurrentDirectory();
      return rootPath || currentPath;
    } catch {
      return currentPath || null;
    }
  }, [currentPath]);

  // 나만의 메모 경로인지 확인
  useEffect(() => {
    const checkMyMemoPath = async (): Promise<void> => {
      if (window.api?.mymemo && currentPath) {
        try {
          const isMyMemo = await window.api.mymemo.isMyMemoPath(currentPath);
          setIsMyMemoPath(isMyMemo);
        } catch {
          setIsMyMemoPath(false);
        }
      } else {
        setIsMyMemoPath(false);
      }
    };
    void checkMyMemoPath();
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

  // 특정 경로의 하위 항목 로드
  const loadChildren = useCallback(async (parentPath: string): Promise<TreeNode[]> => {
    const items = await loadDirectory(parentPath);
    return items.map(item => ({
      ...item,
      isExpanded: false,
      isLoading: false,
    }));
  }, [loadDirectory]);

  // 트리 데이터 초기화
  // 모든 폴더의 children을 미리 로드하여 빈 폴더 여부 확인
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

      // 모든 폴더의 children을 재귀적으로 미리 로드
      const loadAllChildren = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
        return Promise.all(nodes.map(async (node) => {
          if (node.isDirectory) {
            const children = await loadChildren(node.path);
            const loadedChildren = await loadAllChildren(children);
            return {
              ...node,
              children: loadedChildren,
            };
          }
          return node;
        }));
      };

      const nodesWithChildren = await loadAllChildren(rootNodes);
      treeDataRef.current = nodesWithChildren;
      setTreeData(nodesWithChildren);
      
      // 모든 폴더 경로를 loadedPaths에 추가
      const allPaths = new Set([rootPath]);
      const addAllPaths = (nodes: TreeNode[]): void => {
        nodes.forEach(node => {
          if (node.isDirectory) {
            allPaths.add(node.path);
            if (node.children) {
              addAllPaths(node.children);
            }
          }
        });
      };
      addAllPaths(nodesWithChildren);
      setLoadedPaths(allPaths);
    } catch (error) {
      console.error('Error initializing tree:', error);
    } finally {
      setLoading(false);
    }
  }, [getRootPath, loadDirectory, loadChildren]);

  // currentPath 변경 시 트리 재초기화
  useEffect(() => {
    void initializeTree();
  }, [currentPath, initializeTree]);

  // hideNonTextFiles 변경 시 전체 트리 재로드 (모든 폴더의 children 미리 로드)
  useEffect(() => {
    const reloadTree = async (): Promise<void> => {
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

        // 모든 폴더의 children을 재귀적으로 미리 로드
        const loadAllChildren = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
          return Promise.all(nodes.map(async (node) => {
            if (node.isDirectory) {
              const children = await loadChildren(node.path);
              const loadedChildren = await loadAllChildren(children);
              return {
                ...node,
                children: loadedChildren,
              };
            }
            return node;
          }));
        };

        const nodesWithChildren = await loadAllChildren(rootNodes);
        treeDataRef.current = nodesWithChildren;
        setTreeData(nodesWithChildren);
        
        // 모든 폴더 경로를 loadedPaths에 추가
        const allPaths = new Set([rootPath]);
        const addAllPaths = (nodes: TreeNode[]): void => {
          nodes.forEach(node => {
            if (node.isDirectory) {
              allPaths.add(node.path);
              if (node.children) {
                addAllPaths(node.children);
              }
            }
          });
        };
        addAllPaths(nodesWithChildren);
        setLoadedPaths(allPaths);
        setExpandedPaths(new Set()); // 확장된 경로도 초기화
      } catch (error) {
        console.error('Error reloading tree:', error);
      } finally {
        setLoading(false);
      }
    };

    reloadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideNonTextFiles]);

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
        setTreeData(prev => {
          const updated = updateTreeNode(prev, nodePath, node => ({ ...node, isLoading: true }));
          treeDataRef.current = updated;
          return updated;
        });
        
        const children = await loadChildren(nodePath);
        
        setTreeData(prev => {
          const updated = updateTreeNode(prev, nodePath, node => ({
            ...node,
            children,
            isLoading: false,
          }));
          treeDataRef.current = updated;
          return updated;
        });
        
        setLoadedPaths(prev => new Set(prev).add(nodePath));
      }
    }
  }, [expandedPaths, loadedPaths, loadChildren, updateTreeNode]);

  // 이름 변경 핸들러 (renderTreeNode보다 먼저 정의)
  const handleRenameConfirm = useCallback(async (): Promise<void> => {
    if (!renamingPath || !renamingName.trim()) {
      setRenamingPath(null);
      setRenamingName('');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const node = findNodeInTree(treeDataRef.current, renamingPath);
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
      setTreeData(prev => {
        const updated = updateTreeNode(prev, renamingPath, node => ({
          ...node,
          name: renamingName.trim(),
          path: node.path.replace(oldName, renamingName.trim()),
        }));
        treeDataRef.current = updated;
        return updated;
      });
      
      setRenamingPath(null);
      setRenamingName('');
    } catch (err) {
      handleError(err, '이름 변경 중 오류가 발생했습니다.');
    }
  }, [renamingPath, renamingName, findNodeInTree, updateTreeNode]);

  const handleRenameCancel = useCallback((): void => {
    setRenamingPath(null);
    setRenamingName('');
  }, []);

  // ref 업데이트
  useEffect(() => {
    handleRenameConfirmRef.current = handleRenameConfirm;
    handleRenameCancelRef.current = handleRenameCancel;
  }, [handleRenameConfirm, handleRenameCancel]);

  // 특정 폴더만 새로고침 (확장 상태 유지)
  // 열린 폴더 상태를 기억하고 전체 새로고침 후 다시 열어줌
  const refreshFolder = useCallback(async (folderPath: string): Promise<void> => {
    try {
      const rootPath = await getRootPath();
      if (!rootPath) return;
      
      // 현재 열린 폴더들의 경로를 저장
      const savedExpandedPaths = new Set(expandedPaths);
      
      // 전체 트리 새로고침 (모든 폴더의 children 미리 로드)
      const items = await loadDirectory(rootPath);
      const rootNodes: TreeNode[] = items.map(item => ({
        ...item,
        isExpanded: false,
        isLoading: false,
      }));

      // 모든 폴더의 children을 재귀적으로 미리 로드
      const loadAllChildren = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
        return Promise.all(nodes.map(async (node) => {
          if (node.isDirectory) {
            const children = await loadChildren(node.path);
            const loadedChildren = await loadAllChildren(children);
            return {
              ...node,
              children: loadedChildren,
            };
          }
          return node;
        }));
      };

      const nodesWithChildren = await loadAllChildren(rootNodes);
      
      // 저장된 확장 상태를 복원
      const restoreExpandedFolders = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.isDirectory) {
            const isExpanded = savedExpandedPaths.has(node.path);
            return {
              ...node,
              isExpanded,
              children: node.children ? restoreExpandedFolders(node.children) : node.children,
            };
          }
          return node;
        });
      };
      
      const restoredNodes = restoreExpandedFolders(nodesWithChildren);
      treeDataRef.current = restoredNodes;
      setTreeData(restoredNodes);
      
      // 모든 폴더 경로를 loadedPaths에 추가
      const allPaths = new Set([rootPath]);
      const addAllPaths = (nodes: TreeNode[]): void => {
        nodes.forEach(node => {
          if (node.isDirectory) {
            allPaths.add(node.path);
            if (node.children) {
              addAllPaths(node.children);
            }
          }
        });
      };
      addAllPaths(restoredNodes);
      setLoadedPaths(allPaths);
      
      // 확장 상태 복원
      setExpandedPaths(savedExpandedPaths);
    } catch (error) {
      console.error('Error refreshing folder:', error);
    }
  }, [expandedPaths, loadChildren, getRootPath, loadDirectory]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (listRef.current) {
        listRef.current.focus();
      }
    },
    refresh: () => {
      initializeTree();
    },
    refreshFolder: (folderPath: string) => {
      return refreshFolder(folderPath);
    },
    startRenameForPath: (filePath: string) => {
      setRenamingPath(filePath);
      const node = findNodeInTree(treeDataRef.current, filePath);
      if (node) {
        setRenamingName(node.name);
      }
    },
    getDraggedFolderPath: () => draggedFolderPath,
    getSelectedFolderPath: () => {
      if (!cursorPath) return null;
      const node = findNodeInTree(treeDataRef.current, cursorPath);
      if (node && node.isDirectory) {
        return node.path;
      }
      return null;
    },
  }), [initializeTree, findNodeInTree, draggedFolderPath, cursorPath, refreshFolder]);

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

    const handleDragStart = (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggedItem({ path: node.path, isDirectory: node.isDirectory });
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnter = (e: React.DragEvent) => {
      if (node.isDirectory) {
        e.preventDefault();
        e.stopPropagation();
        setDraggedFolderPath(node.path);
      }
    };

    const handleDragLeave = (e: React.DragEvent) => {
      if (node.isDirectory) {
        e.preventDefault();
        e.stopPropagation();
        // 드래그가 실제로 떠났는지 확인 (자식 요소로 이동한 경우 방지)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          setDraggedFolderPath(null);
        }
      }
    };

    const handleDrop = async (e: React.DragEvent) => {
      if (!node.isDirectory || !draggedItem) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // 자기 자신이나 자식 폴더로 이동하려는 경우 방지
      if (draggedItem.path === node.path || node.path.startsWith(draggedItem.path + '\\') || node.path.startsWith(draggedItem.path + '/')) {
        toastService.warning('자기 자신이나 하위 폴더로는 이동할 수 없습니다.');
        setDraggedItem(null);
        setDraggedFolderPath(null);
        return;
      }

      try {
        if (!window.api?.filesystem) {
          toastService.error('API가 로드되지 않았습니다.');
          return;
        }

        const sourcePath = draggedItem.path;
        const fileName = getFileName(sourcePath);
        const destPath = joinPath(node.path, fileName);

        // 같은 위치에 이동하려는 경우 스킵
        if (sourcePath === destPath) {
          setDraggedItem(null);
          setDraggedFolderPath(null);
          return;
        }

        // 이미 존재하는 파일인지 확인
        const items = await window.api.filesystem.listDirectory(node.path);
        const exists = items.some(item => item.name === fileName);
        
        if (exists) {
          toastService.warning(`${fileName}은(는) 이미 존재합니다.`);
          setDraggedItem(null);
          setDraggedFolderPath(null);
          return;
        }

        // 파일/폴더 이동
        await window.api.filesystem.moveFile(sourcePath, destPath);

        // 대상 폴더와 원본 폴더만 새로고침 (확장 상태 유지)
        // 폴더가 확장되어 있지 않아도 children을 업데이트해야 함
        await refreshFolder(node.path);
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf(separator));
        if (sourceParentPath) {
          await refreshFolder(sourceParentPath);
        }
        
        toastService.success('이동됨');
      } catch (err) {
        handleError(err, '이동 중 오류가 발생했습니다.');
      } finally {
        setDraggedItem(null);
        setDraggedFolderPath(null);
      }
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
          className={`flex items-center gap-2 py-1 cursor-pointer text-left ${
            isSelected
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          style={{ 
            paddingLeft: `${8 + depth * 16}px` 
          }}
          onClick={handleNodeClick}
          onContextMenu={handleContextMenu}
          draggable={!isRenaming}
          onDragStart={!isRenaming ? handleDragStart : undefined}
          onDragEnter={node.isDirectory ? handleDragEnter : undefined}
          onDragLeave={node.isDirectory ? handleDragLeave : undefined}
          onDrop={node.isDirectory ? handleDrop : undefined}
          onDragOver={node.isDirectory ? (e: React.DragEvent) => {
            if (draggedItem) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
            }
          } : undefined}
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
                ref={renamingPath === node.path ? renameInputRef : null}
                type="text"
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameConfirmRef.current?.();
                  } else if (e.key === 'Escape' || e.key === 'Esc') {
                    e.preventDefault();
                    handleRenameCancelRef.current?.();
                  }
                  e.stopPropagation();
                }}
                onBlur={() => handleRenameConfirmRef.current?.()}
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
            {node.children.map(child => renderTreeNode(child, depth + 1, flatIndex))}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, cursorPath, renamingPath, renamingName, toggleExpand, onFileSelect, draggedItem, initializeTree, loadChildren, updateTreeNode, findNodeInTree, isMyMemoPath, refreshFolder]);

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
    } else if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePasteFromClipboard();
    }
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
      
      // 삭제 전에 현재 평면화된 노드 리스트 생성 (다음 항목 찾기용)
      const currentFlatNodes = flattenTree(treeData);
      const deletedIndex = currentFlatNodes.findIndex(n => n.path === item.path);
      const wasSelected = cursorPath === item.path;
      
      // 다음 항목 경로 미리 계산
      let nextItemPath: string | null = null;
      if (wasSelected && deletedIndex >= 0) {
        // 삭제될 항목을 제외한 리스트에서 다음 항목 찾기
        const remainingNodes = currentFlatNodes.filter((_, index) => index !== deletedIndex);
        if (remainingNodes.length > 0) {
          // 삭제된 항목의 인덱스가 리스트 범위 내에 있으면 그 위치의 항목으로 이동
          // 삭제된 항목이 마지막이었으면 이전 항목으로 이동
          const nextIndex = deletedIndex < remainingNodes.length ? deletedIndex : remainingNodes.length - 1;
          if (nextIndex >= 0) {
            nextItemPath = remainingNodes[nextIndex].path;
          }
        }
      }
      
      // 파일 삭제 시 탭 제거 및 선택 해제
      if (!item.isDirectory) {
        if (onFileDeleted) {
          onFileDeleted(item.path);
        }
        if (onFileSelect && selectedFilePath === item.path) {
          onFileSelect('');
        }
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
      
      setTreeData(prev => {
        const updated = removeNode(prev, item.path);
        treeDataRef.current = updated;
        return updated;
      });
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(item.path);
        return next;
      });
      
      // 삭제된 항목이 선택되어 있었고, 다음 항목이 있으면 커서 이동
      if (wasSelected) {
        setTimeout(() => {
          if (nextItemPath) {
            setCursorPath(nextItemPath);
          } else {
            setCursorPath(null);
          }
          
          // 포커스 복귀
          setTimeout(() => {
            if (listRef.current) {
              listRef.current.focus();
            }
          }, 50);
        }, 100);
      }
      
      // 삭제된 항목의 부모 폴더만 새로고침 (확장 상태 유지)
      const separator = item.path.includes('\\') ? '\\' : '/';
      const parentPath = item.path.substring(0, item.path.lastIndexOf(separator));
      if (parentPath) {
        await refreshFolder(parentPath);
      } else {
        // 루트 경로인 경우 루트 폴더만 새로고침
        const rootPath = await getRootPath();
        if (rootPath) {
          await refreshFolder(rootPath);
        }
      }
    } catch (err) {
      handleError(err, '삭제 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  useEffect(() => {
    if (showDeleteDialog && deleteDialogRef.current) {
      deleteDialogRef.current.focus();
    }
  }, [showDeleteDialog]);

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

  const handlePaste = useCallback(async () => {
    if (!clipboard || !window.api?.filesystem) return;

    try {
      const sourcePath = clipboard.path;
      const sourceName = getFileName(sourcePath);
      const destPath = joinPath(currentPath, sourceName);

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

      // 현재 폴더와 원본 폴더만 새로고침 (확장 상태 유지)
      await refreshFolder(currentPath);
      if (clipboard.isCut) {
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf(separator));
        if (sourceParentPath && sourceParentPath !== currentPath) {
          await refreshFolder(sourceParentPath);
        }
      }
      
      toastService.success(clipboard.isCut ? '이동됨' : '복사됨');
    } catch (err) {
      handleError(err, '붙여넣기 중 오류가 발생했습니다.');
    }
  }, [clipboard, currentPath, onFileSelect, selectedFilePath, refreshFolder]);

  const handleContextMenuDelete = () => {
    if (!contextMenu || !contextMenu.item || !contextMenu.path) return;
    const { item, path } = contextMenu;
    setShowDeleteDialog({ item, path });
    setContextMenu(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 내부 파일/폴더 드래그인 경우 move, 외부 파일 드래그인 경우 copy
    e.dataTransfer.dropEffect = draggedItem ? 'move' : 'copy';
  }, [draggedItem]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 내부 파일/폴더 드래그인 경우 루트 폴더로 이동 처리
    if (draggedItem) {
      try {
        if (!window.api?.filesystem) {
          toastService.error('API가 로드되지 않았습니다.');
          return;
        }

        const rootPath = await getRootPath();
        if (!rootPath) {
          toastService.error('대상 경로를 찾을 수 없습니다.');
          return;
        }

        const sourcePath = draggedItem.path;
        const fileName = getFileName(sourcePath);
        const destPath = joinPath(rootPath, fileName);

        // 같은 위치에 이동하려는 경우 스킵
        if (sourcePath === destPath) {
          setDraggedItem(null);
          setDraggedFolderPath(null);
          return;
        }

        // 이미 존재하는 파일인지 확인
        const items = await window.api.filesystem.listDirectory(rootPath);
        const exists = items.some(item => item.name === fileName);
        
        if (exists) {
          toastService.warning(`${fileName}은(는) 이미 존재합니다.`);
          setDraggedItem(null);
          setDraggedFolderPath(null);
          return;
        }

        // 파일/폴더 이동
        await window.api.filesystem.moveFile(sourcePath, destPath);

        // 루트 폴더와 원본 폴더만 새로고침 (확장 상태 유지)
        if (rootPath) {
          await refreshFolder(rootPath);
        }
        const separator = sourcePath.includes('\\') ? '\\' : '/';
        const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf(separator));
        if (sourceParentPath && sourceParentPath !== rootPath) {
          await refreshFolder(sourceParentPath);
        }
        
        toastService.success('이동됨');
      } catch (err) {
        handleError(err, '이동 중 오류가 발생했습니다.');
      } finally {
        setDraggedItem(null);
        setDraggedFolderPath(null);
      }
      return;
    }

    // 외부 파일 드롭 처리
    if (!window.api?.filesystem) {
      toastService.error('API가 로드되지 않았습니다.');
      return;
    }

    try {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) {
        return;
      }

      const rootPath = await getRootPath();
      if (!rootPath) {
        toastService.error('대상 경로를 찾을 수 없습니다.');
        return;
      }

      for (const file of files) {
        // Electron의 File 객체는 path 속성을 가지고 있음
        const sourcePath = (file as File & { path?: string }).path || file.name;
        const fileName = getFileName(sourcePath);
        const destPath = joinPath(rootPath, fileName);

        // 같은 위치에 붙여넣으려는 경우 스킵
        if (sourcePath === destPath) {
          continue;
        }

        // 이미 존재하는 파일인지 확인
        const items = await window.api.filesystem.listDirectory(rootPath);
        const exists = items.some(item => item.name === fileName);
        
        if (exists) {
          toastService.warning(`${fileName}은(는) 이미 존재합니다.`);
          continue;
        }

        // 파일 복사
        await window.api.filesystem.copyFile(sourcePath, destPath);
      }

      // 루트 폴더만 새로고침 (확장 상태 유지)
      if (rootPath) {
        await refreshFolder(rootPath);
      }
      
      toastService.success('파일이 복사되었습니다.');
      setDraggedFolderPath(null);
    } catch (err) {
      handleError(err, '파일 붙여넣기 중 오류가 발생했습니다.');
      setDraggedFolderPath(null);
    }
  }, [draggedItem, getRootPath, refreshFolder]);

  const handlePasteFromClipboard = useCallback(async () => {
    if (!window.api?.filesystem) {
      toastService.error('API가 로드되지 않았습니다.');
      return;
    }

    // 내부 클립보드가 있으면 기존 붙여넣기 로직 사용
    if (clipboard) {
      await handlePaste();
      return;
    }

    // 외부에서 복사한 파일은 드래그 앤 드롭으로만 처리 가능
    // Ctrl+V는 내부 클립보드가 있을 때만 작동
    toastService.info('붙여넣을 파일이 없습니다. 파일을 드래그 앤 드롭하거나 컨텍스트 메뉴에서 복사한 후 붙여넣으세요.');
  }, [clipboard, handlePaste]);

  const handleDragEnd = useCallback(() => {
    setDraggedFolderPath(null);
    setDraggedItem(null);
  }, []);

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
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-1 overflow-y-auto flex-1"
        onContextMenu={handleBlankSpaceContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
          onNewFile={onNewFileClick}
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
