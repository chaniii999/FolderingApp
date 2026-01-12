import { useState, useEffect, useRef, useCallback } from 'react';
import type { CustomTemplate, TemplatePart } from '../../types/myMemo';
import { toastService } from '../../services/toastService';
import { getErrorMessage } from '../../utils/errorHandler';
import { getTemplatesPath } from '../../services/myMemoService';
import { joinPath } from '../../utils/pathUtils';

interface TemplateEditDialogProps {
  template?: CustomTemplate | null; // 기존 템플릿이면 전달, 새 템플릿이면 null
  templatePath?: string | null; // 기존 템플릿의 파일 경로 (편집 시)
  onClose: () => void;
  onSave: (templatePath: string) => void;
}

function TemplateEditDialog({ template, templatePath: initialTemplatePath, onClose, onSave }: TemplateEditDialogProps) {
  const [templateData, setTemplateData] = useState<CustomTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 초기 템플릿 데이터 설정
  useEffect(() => {
    if (template) {
      // 기존 템플릿 편집
      setTemplateData(template);
      setTemplateName(template.name);
    } else {
      // 새 템플릿 생성
      const newTemplate: CustomTemplate = {
        id: `template-${Date.now()}`,
        name: '새 템플릿',
        description: '',
        parts: [
          {
            id: 'part-1',
            title: '내용',
            type: 'textarea',
            default: '',
            order: 0,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplateData(newTemplate);
      setTemplateName('새 템플릿');
    }
  }, [template]);

  // 입력 필드에 포커스
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, []);

  // 변경사항 추적
  useEffect(() => {
    if (templateData) {
      const currentJson = JSON.stringify(templateData, null, 2);
      const originalJson = template ? JSON.stringify(template, null, 2) : '';
      setHasChanges(currentJson !== originalJson || templateName !== (template?.name || '새 템플릿'));
    }
  }, [templateData, templateName, template]);

  const handleSave = async (): Promise<void> => {
    if (!templateData || !templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      if (!window.api?.mymemo) {
        throw new Error('MyMemo API가 로드되지 않았습니다.');
      }

      const templatesPath = await getTemplatesPath();
      const templateFileName = `${templateName.trim()}.json`;
      const newTemplatePath = joinPath(templatesPath, templateFileName);

      // 기존 템플릿이면 기존 파일 경로 사용
      const finalPath = initialTemplatePath || 
        (template && template.id ? (await findTemplatePath(template.id)) : null) || 
        newTemplatePath;

      // 템플릿 데이터 업데이트
      const updatedTemplate: CustomTemplate = {
        ...templateData,
        name: templateName.trim(),
        updatedAt: new Date().toISOString(),
      };

      const templateContent = JSON.stringify(updatedTemplate, null, 2);

      // 파일 저장
      if (initialTemplatePath && finalPath === initialTemplatePath) {
        // 기존 파일이면 업데이트
        await window.api.filesystem.writeFile(finalPath, templateContent);
      } else {
        // 새 파일 생성 또는 이름이 변경된 경우
        await window.api.filesystem.createFile(finalPath, templateContent);
        
        // 기존 파일이 있고 이름이 변경된 경우 기존 파일 삭제
        if (initialTemplatePath && finalPath !== initialTemplatePath) {
          try {
            await window.api.filesystem.deleteFile(initialTemplatePath);
          } catch {
            // 삭제 실패는 무시 (파일이 없을 수 있음)
          }
        }
      }

      toastService.success('템플릿이 저장되었습니다.');
      onSave(finalPath);
      onClose();
    } catch (err) {
      const errorMessage = getErrorMessage(err, '템플릿 저장 중 오류가 발생했습니다.');
      setError(errorMessage);
      toastService.error(errorMessage);
    }
  };

  // 템플릿 ID로 파일 경로 찾기
  const findTemplatePath = async (templateId: string): Promise<string | null> => {
    try {
      const templatesPath = await getTemplatesPath();
      const items = await window.api.filesystem.listDirectory(templatesPath);
      const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await window.api.filesystem.readFile(file.path);
          if (content) {
            const parsed = JSON.parse(content) as CustomTemplate;
            if (parsed.id === templateId) {
              return file.path;
            }
          }
        } catch {
          // 무시
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handlePartChange = useCallback((partId: string, field: keyof TemplatePart, value: string | number | boolean | string[]) => {
    if (!templateData) return;

    setTemplateData({
      ...templateData,
      parts: templateData.parts.map(part =>
        part.id === partId ? { ...part, [field]: value } : part
      ),
    });
  }, [templateData]);

  const handleAddPart = useCallback(() => {
    if (!templateData) return;

    const newPart: TemplatePart = {
      id: `part-${Date.now()}`,
      title: '새 파트',
      type: 'textarea',
      default: '',
      order: templateData.parts.length,
    };

    setTemplateData({
      ...templateData,
      parts: [...templateData.parts, newPart],
    });
  }, [templateData]);

  const handleDeletePart = useCallback((partId: string) => {
    if (!templateData) return;

    setTemplateData({
      ...templateData,
      parts: templateData.parts.filter(part => part.id !== partId).map((part, index) => ({
        ...part,
        order: index,
      })),
    });
  }, [templateData]);

  const handleMovePart = useCallback((partId: string, direction: 'up' | 'down') => {
    if (!templateData) return;

    const index = templateData.parts.findIndex(part => part.id === partId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= templateData.parts.length) return;

    const newParts = [...templateData.parts];
    [newParts[index], newParts[newIndex]] = [newParts[newIndex], newParts[index]];
    
    newParts.forEach((part, i) => {
      part.order = i;
    });

    setTemplateData({
      ...templateData,
      parts: newParts,
    });
  }, [templateData]);

  if (!templateData) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">
          {template ? '템플릿 편집' : '새 템플릿 만들기'}
        </h3>

        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {/* 템플릿 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              템플릿 이름
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="템플릿 이름을 입력하세요"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명 (선택사항)
            </label>
            <textarea
              value={templateData.description || ''}
              onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={2}
            />
          </div>

          {/* 파트 목록 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100">파트</h4>
              <button
                onClick={handleAddPart}
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                파트 추가
              </button>
            </div>

            {templateData.parts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                파트가 없습니다. 파트를 추가해주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {templateData.parts
                  .sort((a, b) => a.order - b.order)
                  .map((part, index) => (
                    <div
                      key={part.id}
                      className="border border-gray-300 dark:border-gray-600 rounded p-4 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          파트 {index + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMovePart(part.id, 'up')}
                            disabled={index === 0}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMovePart(part.id, 'down')}
                            disabled={index === templateData.parts.length - 1}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleDeletePart(part.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            제목
                          </label>
                          <input
                            type="text"
                            value={part.title}
                            onChange={(e) => handlePartChange(part.id, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            기본값 (선택사항)
                          </label>
                          <input
                            type="text"
                            value={part.default || ''}
                            onChange={(e) => handlePartChange(part.id, 'default', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`required-${part.id}`}
                            checked={part.required || false}
                            onChange={(e) => handlePartChange(part.id, 'required', e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor={`required-${part.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                            필수 항목
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end border-t border-gray-300 dark:border-gray-600 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            취소
          </button>
          <button
            onClick={() => void handleSave()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditDialog;
