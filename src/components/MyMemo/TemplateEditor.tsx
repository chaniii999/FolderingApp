import { useState, useEffect, useCallback } from 'react';
import type { CustomTemplate, TemplatePart } from '../../types/myMemo';
import { toastService } from '../../services/toastService';
import { getErrorMessage } from '../../utils/errorHandler';

interface TemplateEditorProps {
  filePath: string;
  content: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  config: { horizontalPadding: number; fontSize: number };
}

function TemplateEditor({ filePath, content, onSave, onCancel, config }: TemplateEditorProps) {
  const [template, setTemplate] = useState<CustomTemplate | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JSON 파싱 및 템플릿 로드
  useEffect(() => {
    if (!content || content.trim() === '') {
      setError('템플릿 내용이 비어있습니다.');
      setTemplate(null);
      return;
    }

    try {
      const parsed = JSON.parse(content) as CustomTemplate;
      // 템플릿 형식 검증
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.parts)) {
        throw new Error('템플릿 형식이 올바르지 않습니다.');
      }
      setTemplate(parsed);
      setError(null);
    } catch (err) {
      setError('템플릿 파일 형식이 올바르지 않습니다.');
      console.error('Error parsing template:', err);
      setTemplate(null);
    }
  }, [content]);

  // 변경사항 추적
  useEffect(() => {
    if (template) {
      const currentJson = JSON.stringify(template, null, 2);
      setHasChanges(currentJson !== content);
    }
  }, [template, content]);

  const handleSave = useCallback(async () => {
    if (!template) return;

    try {
      const updatedTemplate: CustomTemplate = {
        ...template,
        updatedAt: new Date().toISOString(),
      };
      const jsonContent = JSON.stringify(updatedTemplate, null, 2);
      await onSave(jsonContent);
      toastService.success('템플릿이 저장되었습니다.');
    } catch (err) {
      const errorMessage = getErrorMessage(err, '저장 중 오류가 발생했습니다.');
      toastService.error(errorMessage);
    }
  }, [template, onSave]);

  const handlePartChange = useCallback((partId: string, field: keyof TemplatePart, value: string | number | boolean | string[]) => {
    if (!template) return;

    setTemplate({
      ...template,
      parts: template.parts.map(part =>
        part.id === partId ? { ...part, [field]: value } : part
      ),
    });
  }, [template]);

  const handleAddPart = useCallback(() => {
    if (!template) return;

    const newPart: TemplatePart = {
      id: `part-${Date.now()}`,
      title: '새 파트',
      type: 'textarea',
      default: '',
      order: template.parts.length,
    };

    setTemplate({
      ...template,
      parts: [...template.parts, newPart],
    });
  }, [template]);

  const handleDeletePart = useCallback((partId: string) => {
    if (!template) return;

    setTemplate({
      ...template,
      parts: template.parts.filter(part => part.id !== partId).map((part, index) => ({
        ...part,
        order: index,
      })),
    });
  }, [template]);

  const handleMovePart = useCallback((partId: string, direction: 'up' | 'down') => {
    if (!template) return;

    const index = template.parts.findIndex(part => part.id === partId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.parts.length) return;

    const newParts = [...template.parts];
    [newParts[index], newParts[newIndex]] = [newParts[newIndex], newParts[index]];
    
    // order 업데이트
    newParts.forEach((part, i) => {
      part.order = i;
    });

    setTemplate({
      ...template,
      parts: newParts,
    });
  }, [template]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
        }}
      >
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
        }}
      >
        <div className="text-gray-500 dark:text-gray-400">템플릿을 로드하는 중...</div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        paddingLeft: `${config.horizontalPadding}px`,
        paddingRight: `${config.horizontalPadding}px`,
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        fontSize: `${config.fontSize}px`,
      }}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              템플릿 이름
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명 (선택사항)
            </label>
            <textarea
              value={template.description || ''}
              onChange={(e) => setTemplate({ ...template, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={2}
            />
          </div>
        </div>

        {/* 파트 목록 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">파트</h3>
            <button
              onClick={handleAddPart}
              className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              파트 추가
            </button>
          </div>

          {template.parts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              파트가 없습니다. 파트를 추가해주세요.
            </div>
          ) : (
            <div className="space-y-3">
              {template.parts
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
                          disabled={index === template.parts.length - 1}
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
                          타입
                        </label>
                        <select
                          value={part.type}
                          onChange={(e) => handlePartChange(part.id, 'type', e.target.value as TemplatePart['type'])}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="textarea">텍스트 영역</option>
                          <option value="text">텍스트</option>
                          <option value="number">숫자</option>
                          <option value="date">날짜</option>
                          <option value="select">선택</option>
                        </select>
                      </div>

                      {part.type === 'select' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            옵션 (쉼표로 구분)
                          </label>
                          <input
                            type="text"
                            value={part.options?.join(', ') || ''}
                            onChange={(e) => {
                              const options = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                              handlePartChange(part.id, 'options', options);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="옵션1, 옵션2, 옵션3"
                          />
                        </div>
                      )}

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

        {/* 저장/취소 버튼 */}
        {hasChanges && (
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-300 dark:border-gray-600">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              저장 (Ctrl+S)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateEditor;
