/**
 * 성능 모니터링 유틸리티
 * 컴포넌트 렌더링 시간, 리렌더링 횟수 등을 측정
 */

interface PerformanceMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  minRenderTime: number;
  maxRenderTime: number;
  lastRenderTime: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private renderStartTimes: Map<string, number> = new Map();

  /**
   * 컴포넌트 렌더링 시작
   */
  startRender(componentName: string): void {
    if (typeof window === 'undefined') return;
    this.renderStartTimes.set(componentName, performance.now());
  }

  /**
   * 컴포넌트 렌더링 종료
   */
  endRender(componentName: string): void {
    if (typeof window === 'undefined') return;
    const startTime = this.renderStartTimes.get(componentName);
    if (!startTime) return;

    const renderTime = performance.now() - startTime;
    const existing = this.metrics.get(componentName);

    if (existing) {
      existing.renderCount++;
      existing.totalRenderTime += renderTime;
      existing.averageRenderTime = existing.totalRenderTime / existing.renderCount;
      existing.minRenderTime = Math.min(existing.minRenderTime, renderTime);
      existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
      existing.lastRenderTime = renderTime;
    } else {
      this.metrics.set(componentName, {
        componentName,
        renderCount: 1,
        totalRenderTime: renderTime,
        averageRenderTime: renderTime,
        minRenderTime: renderTime,
        maxRenderTime: renderTime,
        lastRenderTime: renderTime,
      });
    }

    this.renderStartTimes.delete(componentName);
  }

  /**
   * 특정 컴포넌트의 메트릭 가져오기
   */
  getMetrics(componentName: string): PerformanceMetrics | undefined {
    return this.metrics.get(componentName);
  }

  /**
   * 모든 메트릭 가져오기
   */
  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.metrics.clear();
    this.renderStartTimes.clear();
  }

  /**
   * 콘솔에 성능 리포트 출력
   */
  printReport(): void {
    const metrics = this.getAllMetrics();
    if (metrics.length === 0) {
      console.log('📊 성능 메트릭이 없습니다.');
      return;
    }

    console.group('📊 성능 리포트');
    console.table(
      metrics.map((m) => ({
        컴포넌트: m.componentName,
        렌더링_횟수: m.renderCount,
        평균_시간: `${m.averageRenderTime.toFixed(2)}ms`,
        최소_시간: `${m.minRenderTime.toFixed(2)}ms`,
        최대_시간: `${m.maxRenderTime.toFixed(2)}ms`,
        마지막_시간: `${m.lastRenderTime.toFixed(2)}ms`,
        총_시간: `${m.totalRenderTime.toFixed(2)}ms`,
      }))
    );

    // 총 렌더링 횟수
    const totalRenders = metrics.reduce((sum, m) => sum + m.renderCount, 0);
    const totalTime = metrics.reduce((sum, m) => sum + m.totalRenderTime, 0);
    const avgTime = totalTime / totalRenders;

    console.log(`\n📈 전체 통계:`);
    console.log(`  총 렌더링 횟수: ${totalRenders}`);
    console.log(`  총 렌더링 시간: ${totalTime.toFixed(2)}ms`);
    console.log(`  평균 렌더링 시간: ${avgTime.toFixed(2)}ms`);

    // 가장 많이 리렌더링된 컴포넌트
    const mostRendered = metrics.reduce((prev, current) =>
      prev.renderCount > current.renderCount ? prev : current
    );
    console.log(`\n⚠️ 가장 많이 리렌더링된 컴포넌트: ${mostRendered.componentName} (${mostRendered.renderCount}회)`);

    // 가장 느린 컴포넌트
    const slowest = metrics.reduce((prev, current) =>
      prev.averageRenderTime > current.averageRenderTime ? prev : current
    );
    console.log(`🐌 가장 느린 컴포넌트: ${slowest.componentName} (평균 ${slowest.averageRenderTime.toFixed(2)}ms)`);

    console.groupEnd();
  }

  /**
   * 성능 리포트를 JSON으로 내보내기
   */
  exportReport(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics: this.getAllMetrics(),
        summary: {
          totalRenders: this.getAllMetrics().reduce((sum, m) => sum + m.renderCount, 0),
          totalTime: this.getAllMetrics().reduce((sum, m) => sum + m.totalRenderTime, 0),
        },
      },
      null,
      2
    );
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = new PerformanceMonitor();

// HOC는 usePerformanceMeasure hook을 사용하는 것을 권장합니다.

// 전역에서 접근 가능하도록 window에 추가
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
  (window as any).showPerformanceReport = () => {
    performanceMonitor.printReport();
  };
  (window as any).resetPerformanceMetrics = () => {
    performanceMonitor.reset();
    console.log('✅ 성능 메트릭이 초기화되었습니다.');
  };
  (window as any).exportPerformanceReport = () => {
    const report = performanceMonitor.exportReport();
    console.log('📄 성능 리포트 (JSON):');
    console.log(report);
    return report;
  };
}

