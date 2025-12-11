import { type Toast, type ToastType } from '../components/Toast';

type ToastListener = (toasts: Toast[]) => void;

class ToastService {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private nextId = 0;

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }

  show(message: string, type: ToastType = 'info', duration?: number) {
    const id = `toast-${this.nextId++}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration,
    };

    this.toasts.push(toast);
    this.notify();

    return id;
  }

  success(message: string, duration?: number) {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    // 에러는 기본적으로 더 오래 표시
    return this.show(message, 'error', duration ?? 5000);
  }

  warning(message: string, duration?: number) {
    return this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number) {
    return this.show(message, 'info', duration);
  }

  close(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notify();
  }

  closeAll() {
    this.toasts = [];
    this.notify();
  }
}

export const toastService = new ToastService();

