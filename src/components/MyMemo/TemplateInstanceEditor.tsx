import { useState, useEffect, useCallback, useRef } from 'react';
import type { CustomTemplate, TemplateInstance, TemplatePart } from '../../types/myMemo';
import { getFileName } from '../../utils/pathUtils';

interface TemplateInstanceEditorProps {
  filePath: string;
  content: string;
  config: { horizontalPadding: number; fontSize: number };
  onContentChange: (newContent: string) => void;
  onSave: () => Promise<void>;
}

/**
 * 템플릿 인스턴스 전용 편집 컴포넌트
 * 템플릿 뷰어와 유사하지만 파트 값 부분을 입력폼으로 표시
 */
function TemplateInstanceEditor({ filePath, content, config, onContentChange, onSave }: TemplateInstanceEditorProps) {
  const [instance, setInstance] = useState<TemplateInstance | null>(null);
  const [templateData, setTemplateData] = useState<CustomTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partValues, setPartValues] = useState<Record<string, string>>({});
  const fileName = getFileName(filePath);
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const isComposingRef = useRef<Map<string, boolean>>(new Map());

  // JSON 파싱 및 템플릿 인스턴스 로드
  useEffect(() => {
    if (!content || content.trim() === '') {
      setError('템플릿 내용이 비어있습니다.');
      setInstance(null);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      
      // TemplateInstance 형식인지 확인
      if (typeof parsed.templateId === 'string' && typeof parsed.data === 'object' && parsed.data !== null) {
        const templateInstance: TemplateInstance = {
          id: parsed.id || '',
          templateId: parsed.templateId,
          fileName: parsed.fileName || fileName,
          filePath: parsed.filePath || filePath,
          data: parsed.data,
          createdAt: parsed.createdAt || '',
          updatedAt: parsed.updatedAt || '',
        };
        
        setInstance(templateInstance);
        setPartValues(parsed.data || {});
        setError(null);
        
        // 템플릿 정보 가져오기
        if (window.api?.mymemo && window.api?.filesystem) {
          (async () => {
            try {
              const { getTemplatesPath } = await import('../../services/myMemoService');
              const templatesPath = await getTemplatesPath();
              const items = await window.api.filesystem.listDirectory(templatesPath);
              const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));
              
              for (const file of jsonFiles) {
                try {
                  const templateContent = await window.api.filesystem.readFile(file.path);
                  if (templateContent) {
                    const template = JSON.parse(templateContent) as CustomTemplate;
                    if (template.id === templateInstance.templateId) {
                      setTemplateData(template);
                      // 템플릿의 모든 파트에 대해 기본값 설정 (없는 경우)
                      const newPartValues: Record<string, string> = { ...parsed.data };
                      template.parts.forEach(part => {
                        if (!(part.id in newPartValues)) {
                          newPartValues[part.id] = part.default || '';
                        }
                      });
                      setPartValues(newPartValues);
                      break;
                    }
                  }
                } catch {
                  // 무시
                }
              }
            } catch {
              // 무시
            }
          })();
        }
        return;
      }

      setError('템플릿 인스턴스 형식이 올바르지 않습니다.');
      setInstance(null);
    } catch (err) {
      console.error('TemplateInstanceEditor - Error parsing template:', err);
      setError('JSON 파싱 오류가 발생했습니다.');
      setInstance(null);
    }
  }, [content, filePath, fileName]);

  // 파트 값 변경 핸들러
  const handlePartValueChange = useCallback((partId: string, value: string) => {
    setPartValues(prev => {
      const newValues = { ...prev, [partId]: value };
      
      // IME 입력 중이 아닐 때만 content 변경
      if (instance && !isComposingRef.current.get(partId)) {
        const updatedInstance: TemplateInstance = {
          ...instance,
          data: newValues,
        };
        const newContent = JSON.stringify(updatedInstance, null, 2);
        onContentChange(newContent);
      }
      
      return newValues;
    });
  }, [instance, onContentChange]);

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // 파트 타입에 따른 입력 필드 렌더링
  const renderInputField = (part: TemplatePart, value: string) => {
    const commonProps = {
      value: value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handlePartValueChange(part.id, e.target.value);
      },
      onCompositionStart: () => {
        isComposingRef.current.set(part.id, true);
      },
      onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        isComposingRef.current.set(part.id, false);
        // IME 입력 종료 후 최종 값으로 업데이트
        handlePartValueChange(part.id, e.currentTarget.value);
      },
      placeholder: part.placeholder || '',
      className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
      style: {
        fontSize: `${config.fontSize}px`,
      },
    };

    switch (part.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={6}
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
            className={`${commonProps.className} resize-y`}
          />
        );
      case 'text':
        return (
          <input
            {...commonProps}
            type="text"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
          />
        );
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
          />
        );
      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handlePartValueChange(part.id, e.target.value)}
            placeholder={part.placeholder || ''}
            className={commonProps.className}
            style={commonProps.style}
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
          >
            <option value="">선택하세요</option>
            {part.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            {...commonProps}
            type="text"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.id, el);
              }
            }}
          />
        );
    }
  };

  // 에러 표시
  if (error && !instance) {
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

  // 로딩 중
  if (!instance || !templateData) {
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

  const parts = templateData.parts || [];
  const sortedParts = [...parts].sort((a, b) => a.order - b.order);

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
      <div className="max-w-4xl mx-auto">
        {/* 헤더: 파일명(좌측) + 날짜(우측) */}
        <div className="flex items-start justify-between mb-8 pb-4 border-b border-gray-300 dark:border-gray-600">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {fileName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
            {instance.updatedAt && instance.updatedAt !== instance.createdAt && (
              <div>수정: {formatDate(instance.updatedAt)}</div>
            )}
            {instance.createdAt && (
              <div>작성: {formatDate(instance.createdAt)}</div>
            )}
          </div>
        </div>

        {/* 편집 폼: 파트별 입력 필드 */}
        <div className="space-y-8">
          {sortedParts.length > 0 ? (
            sortedParts.map((part) => {
              const value = partValues[part.id] || '';
              
              return (
                <div key={part.id} className="space-y-2">
                  <label className="block text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {part.title}
                    {part.required && (
                      <span className="ml-2 text-red-600 dark:text-red-400 text-lg">*</span>
                    )}
                  </label>
                  {renderInputField(part, value)}
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              템플릿 파트 정보가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateInstanceEditor;
