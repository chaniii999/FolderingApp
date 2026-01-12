/**
 * 커스텀 템플릿 관련 타입 정의
 */

/**
 * 템플릿 파트 타입
 */
export type TemplatePartType = 'textarea' | 'text' | 'number' | 'date' | 'select';

/**
 * 템플릿 파트 정의
 */
export interface TemplatePart {
  id: string;
  title: string;
  type: TemplatePartType;
  default?: string;
  placeholder?: string;
  options?: string[]; // select 타입일 때 사용
  required?: boolean;
  order: number;
}

/**
 * 커스텀 템플릿 정의
 */
export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  parts: TemplatePart[];
  htmlTemplate?: string; // HTML 렌더링용 템플릿 (선택사항)
  createdAt: string;
  updatedAt: string;
}

/**
 * 템플릿 인스턴스 (실제 작성된 내용)
 */
export interface TemplateInstance {
  id: string;
  templateId: string;
  fileName: string;
  filePath: string;
  data: Record<string, string>; // partId -> content 매핑
  createdAt: string;
  updatedAt: string;
}
