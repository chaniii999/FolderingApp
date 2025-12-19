import { useRef, useCallback } from 'react';

interface UseScrollAccelerationOptions {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  baseScrollAmount?: number;
  scrollInterval?: number;
}

interface ScrollSpeedThresholds {
  fast: number;
  faster: number;
  max: number;
}

const DEFAULT_SCROLL_AMOUNT = 30;
const DEFAULT_SCROLL_INTERVAL = 50;
const DEFAULT_SPEED_THRESHOLDS: ScrollSpeedThresholds = {
  fast: 500,
  faster: 1000,
  max: 2000,
};

/**
 * 스크롤 가속도 기능을 제공하는 커스텀 훅
 * 
 * @param scrollContainerRef 스크롤할 컨테이너의 ref
 * @param baseScrollAmount 기본 스크롤 양 (기본값: 30)
 * @param scrollInterval 스크롤 간격 (기본값: 50ms)
 * @returns 스크롤 제어 함수들
 */
export function useScrollAcceleration({
  scrollContainerRef,
  baseScrollAmount = DEFAULT_SCROLL_AMOUNT,
  scrollInterval = DEFAULT_SCROLL_INTERVAL,
}: UseScrollAccelerationOptions) {
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollSpeedRef = useRef<number>(1);
  const scrollStartTimeRef = useRef<number>(0);

  const performScroll = useCallback((direction: 'up' | 'down', speed: number) => {
    if (!scrollContainerRef.current) return;
    
    const scrollAmount = baseScrollAmount * speed;
    const currentScroll = scrollContainerRef.current.scrollTop;
    const newScroll = direction === 'up' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    
    scrollContainerRef.current.scrollTo({
      top: newScroll,
      behavior: 'auto',
    });
  }, [scrollContainerRef, baseScrollAmount]);

  const stopScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    scrollDirectionRef.current = null;
    scrollSpeedRef.current = 1;
  }, []);

  const startScrolling = useCallback((direction: 'up' | 'down') => {
    // 이미 스크롤 중이면 방향만 업데이트
    if (scrollIntervalRef.current && scrollDirectionRef.current === direction) {
      return;
    }
    
    // 기존 스크롤 중지
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }
    
    scrollDirectionRef.current = direction;
    scrollStartTimeRef.current = Date.now();
    scrollSpeedRef.current = 1;
    
    // 첫 스크롤 즉시 실행
    performScroll(direction, 1);
    
    // 연속 스크롤 시작
    scrollIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - scrollStartTimeRef.current;
      
      // 시간에 따라 속도 증가 (크롬 브라우저 스타일)
      if (elapsed < DEFAULT_SPEED_THRESHOLDS.fast) {
        scrollSpeedRef.current = 1;
      } else if (elapsed < DEFAULT_SPEED_THRESHOLDS.faster) {
        scrollSpeedRef.current = 2;
      } else if (elapsed < DEFAULT_SPEED_THRESHOLDS.max) {
        scrollSpeedRef.current = 3;
      } else {
        scrollSpeedRef.current = 4;
      }
      
      performScroll(direction, scrollSpeedRef.current);
    }, scrollInterval);
  }, [performScroll, scrollInterval]);

  return {
    startScrolling,
    stopScrolling,
    performScroll,
  };
}

