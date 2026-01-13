import { useState, useEffect, useRef } from 'react';
import type { CustomTemplate } from '../../types/myMemo';
import { toastService } from '../../services/toastService';
import { getErrorMessage } from '../../utils/errorHandler';
import { getFileName, joinPath } from '../../utils/pathUtils';
import { getTemplatesPath } from '../../services/myMemoService';
import TemplateEditDialog from './TemplateEditDialog';
import { useBlockGlobalHotkeys } from '../../hooks/useBlockGlobalHotkeys';

interface TemplateManageDialogProps {
  onClose: () => void;
  onTemplateSelect?: (templatePath: string) => void;
  onTemplateInstanceCreate?: (template: CustomTemplate, fileName: string) => void;
  isInstanceMode?: boolean; // 템플릿 인스턴스 생성 모드인지 여부
  defaultFileName?: string; // 기본 파일 이름
  onBackToNewFile?: () => void; // 새로 만들기 창으로 돌아가기
}

function TemplateManageDialog({ onClose, onTemplateSelect, onTemplateInstanceCreate, isInstanceMode = false, defaultFileName = '', onBackToNewFile }: TemplateManageDialogProps) {
  const [templates, setTemplates] = useState<Array<{ path: string; template: CustomTemplate }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [editingTemplatePath, setEditingTemplatePath] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const templateListRef = useRef<HTMLDivElement>(null);

  // 템플릿 목록 로드 함수
  const loadTemplates = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        // 템플릿 경로에서 모든 .json 파일 찾기
        const templatesPath = await getTemplatesPath();
        const items = await window.api.filesystem.listDirectory(templatesPath);
        const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));

        const templateList: Array<{ path: string; template: CustomTemplate }> = [];

        for (const file of jsonFiles) {
          try {
            const content = await window.api.filesystem.readFile(file.path);
            if (content) {
              const template = JSON.parse(content) as CustomTemplate;
              // 템플릿 형식인지 확인 (id, name, parts 필드가 있는지)
              if (template.id && template.name && Array.isArray(template.parts)) {
                templateList.push({ path: file.path, template });
              }
            }
          } catch (err) {
            // JSON 파싱 실패한 파일은 무시
            // 템플릿 파일 파싱 실패 시 무시
          }
        }

        setTemplates(templateList);
      } catch (err) {
        const errorMessage = getErrorMessage(err, '템플릿 목록을 불러오는 중 오류가 발생했습니다.');
        setError(errorMessage);
        toastService.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

  // 템플릿 목록 로드
  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleDelete = async (templatePath: string): Promise<void> => {
    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      await window.api.filesystem.deleteFile(templatePath);
      setTemplates(templates.filter(t => t.path !== templatePath));
      toastService.success('템플릿이 삭제되었습니다.');
    } catch (err) {
      const errorMessage = getErrorMessage(err, '템플릿 삭제 중 오류가 발생했습니다.');
      toastService.error(errorMessage);
    }
  };

  const handleEdit = (templatePath: string): void => {
    const template = templates.find(t => t.path === templatePath);
    if (template) {
      setEditingTemplate(template.template);
      setEditingTemplatePath(templatePath);
      setShowEditDialog(true);
    }
  };

  const handleTemplateSelect = (templatePath: string): void => {
    const template = templates.find(t => t.path === templatePath);
    if (template) {
      if (isInstanceMode && onBackToNewFile) {
        // 템플릿 인스턴스 생성 모드 - 새로 만들기 창으로 돌아가기
        onBackToNewFile(template.template);
        onClose();
      } else if (onTemplateInstanceCreate) {
        // 즉시 생성 모드 (사용하지 않음)
        const fileName = defaultFileName || template.template.name;
        onTemplateInstanceCreate(template.template, fileName);
        onClose();
      } else if (onTemplateSelect) {
        // 기존 동작 (템플릿 편집 모드)
        onTemplateSelect(templatePath);
        onClose();
      }
    }
  };

  const handleAddNew = (): void => {
    setEditingTemplate(null);
    setEditingTemplatePath(null);
    setShowEditDialog(true);
  };

  const handleTemplateSave = async (templatePath: string): Promise<void> => {
    // 템플릿 목록 새로고침
    await loadTemplates();
    
    // 저장된 템플릿을 편집 모드로 열기 (선택사항)
    if (onTemplateSelect) {
      onTemplateSelect(templatePath);
    }
  };

  const handleEditDialogClose = (): void => {
    setShowEditDialog(false);
    setEditingTemplate(null);
    setEditingTemplatePath(null);
  };

  // 선택된 템플릿 인덱스에 따라 스크롤
  useEffect(() => {
    if (templateListRef.current && templates.length > 0 && selectedTemplateIndex >= 0) {
      const templateElements = templateListRef.current.querySelectorAll('[data-template-item]');
      if (templateElements[selectedTemplateIndex]) {
        templateElements[selectedTemplateIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedTemplateIndex, templates]);

  // 템플릿 목록 로드 후 첫 번째 템플릿 선택
  useEffect(() => {
    if (templates.length > 0 && selectedTemplateIndex === 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].path);
    }
  }, [templates, selectedTemplateIndex, selectedTemplate]);

  // 템플릿 선택 시 인덱스도 업데이트
  useEffect(() => {
    if (selectedTemplate) {
      const index = templates.findIndex(t => t.path === selectedTemplate);
      if (index >= 0 && index !== selectedTemplateIndex) {
        setSelectedTemplateIndex(index);
      }
    }
  }, [selectedTemplate, templates, selectedTemplateIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 모든 키 이벤트를 다이얼로그 내부에서만 처리하도록 전파 차단
    e.stopPropagation();

    // Esc 또는 x로 닫기 (새로 만들기 창으로 돌아가기)
    if (e.key === 'Escape' || e.key === 'Esc' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      if (onBackToNewFile) {
        onBackToNewFile();
      } else {
        onClose();
      }
      return;
    }

    // 템플릿이 없으면 다른 키 처리 안 함
    if (templates.length === 0) {
      return;
    }

    // 위/아래 화살표로 템플릿 선택
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedTemplateIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : prev;
        if (templates[newIndex]) {
          setSelectedTemplate(templates[newIndex].path);
        }
        return newIndex;
      });
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedTemplateIndex((prev) => {
        const newIndex = prev < templates.length - 1 ? prev + 1 : prev;
        if (templates[newIndex]) {
          setSelectedTemplate(templates[newIndex].path);
        }
        return newIndex;
      });
      return;
    }

    // Enter 또는 z로 템플릿 선택
    if ((e.key === 'Enter' || e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      if (selectedTemplate) {
        handleTemplateSelect(selectedTemplate);
      }
      return;
    }
  };

  // 전역 핫키 차단
  useBlockGlobalHotkeys({
    dialogSelector: dialogRef,
    allowArrowKeysInInput: true,
  });

  return (
    <>
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50 ${showEditDialog ? 'pointer-events-none' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !showEditDialog) {
            onClose();
          }
        }}
      >
        <div
          ref={dialogRef}
          className={`bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col ${showEditDialog ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">템플릿 관리</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            로딩 중...
          </div>
        ) : error ? (
          <div className="px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto mb-4">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  템플릿이 없습니다.
                </div>
              ) : (
                <div 
                  ref={templateListRef}
                  className="space-y-2"
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                >
                  {templates.map(({ path, template }, index) => (
                    <div
                      key={path}
                      data-template-item
                      className={`border rounded p-3 cursor-pointer ${
                        selectedTemplate === path
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      onClick={() => {
                        setSelectedTemplate(path);
                        setSelectedTemplateIndex(index);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {template.name}
                          </h4>
                          {template.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            파트 {template.parts.length}개
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {isInstanceMode ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTemplateSelect(path);
                              }}
                              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              선택
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(path);
                                }}
                                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                편집
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(path);
                                }}
                                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end border-t border-gray-300 dark:border-gray-600 pt-4">
              {!isInstanceMode && (
                <button
                  onClick={handleAddNew}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  새 템플릿 추가
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                닫기
              </button>
            </div>
          </>
        )}
        </div>
      </div>
      {showEditDialog && (
        <TemplateEditDialog
          template={editingTemplate}
          templatePath={editingTemplatePath}
          onClose={handleEditDialogClose}
          onSave={handleTemplateSave}
        />
      )}
    </>
  );
}

export default TemplateManageDialog;
