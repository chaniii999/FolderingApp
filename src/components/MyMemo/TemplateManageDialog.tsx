import { useState, useEffect, useRef } from 'react';
import type { CustomTemplate } from '../../types/myMemo';
import { toastService } from '../../services/toastService';
import { getErrorMessage } from '../../utils/errorHandler';
import { getFileName } from '../../utils/pathUtils';
import { getTemplatesPath } from '../../services/myMemoService';

interface TemplateManageDialogProps {
  onClose: () => void;
  onTemplateSelect?: (templatePath: string) => void;
}

function TemplateManageDialog({ onClose, onTemplateSelect }: TemplateManageDialogProps) {
  const [templates, setTemplates] = useState<Array<{ path: string; template: CustomTemplate }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 템플릿 목록 로드
  useEffect(() => {
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
            console.warn(`Failed to parse template file: ${file.path}`, err);
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
    if (onTemplateSelect) {
      onTemplateSelect(templatePath);
    }
    onClose();
  };

  const handleAddNew = (): void => {
    if (onTemplateSelect) {
      // 새 템플릿 생성은 NewFileDialog에서 처리
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
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
                <div className="space-y-2">
                  {templates.map(({ path, template }) => (
                    <div
                      key={path}
                      className={`border rounded p-3 ${
                        selectedTemplate === path
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                      }`}
                      onClick={() => setSelectedTemplate(path)}
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end border-t border-gray-300 dark:border-gray-600 pt-4">
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                새 템플릿 추가
              </button>
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
  );
}

export default TemplateManageDialog;
