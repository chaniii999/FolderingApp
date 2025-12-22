/**
 * React Hook으로 컴포넌트 렌더링 성능 측정
 * 개발 모드에서만 활성화
 * 
 * 주의: 무한 루프를 방지하기 위해 성능 측정을 간소화했습니다.
 * 정확한 측정이 필요하면 React DevTools Profiler를 사용하세요.
 */
/// <reference types="vite/client" />
import { useEffect, useRef } from 'react';
import { performanceMonitor } from './performanceMonitor';

const isDev = import.meta.env.MODE === 'development';
const ENABLE_PERFORMANCE_MEASURE = false; // 무한 루프 방지를 위해 임시 비활성화

export function usePerformanceMeasure(componentName: string): void {
  if (!isDev || !ENABLE_PERFORMANCE_MEASURE) return;

  const mountedRef = useRef(false);
  const frameIdRef = useRef<number | null>(null);

  // 컴포넌트 마운트 시에만 측정 시작
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    performanceMonitor.startRender(componentName);

    // 다음 프레임에서 측정 종료
    frameIdRef.current = requestAnimationFrame(() => {
      performanceMonitor.endRender(componentName);
      frameIdRef.current = null;
    });

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시에만 실행
}

