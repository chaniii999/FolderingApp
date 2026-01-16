import { type Toast, type ToastAction, type ToastType } from '../components/Toast';

type ToastListener = (toasts: Toast[]) => void;

interface ToastOptions {
  duration?: number;
  actions?: ToastAction[];
}

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

  show(message: string, type: ToastType = 'info', options?: number | ToastOptions) {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options;
    const id = `toast-${this.nextId++}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration: normalizedOptions?.duration,
      actions: normalizedOptions?.actions,
    };

    this.toasts.push(toast);
    this.notify();

    return id;
  }

  success(message: string, options?: number | ToastOptions) {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options;
    return this.show(message, 'success', { duration: normalizedOptions?.duration ?? 1000, actions: normalizedOptions?.actions });
  }

  error(message: string, options?: number | ToastOptions) {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options;
    return this.show(message, 'error', { duration: normalizedOptions?.duration ?? 1000, actions: normalizedOptions?.actions });
  }

  warning(message: string, options?: number | ToastOptions) {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options;
    return this.show(message, 'warning', { duration: normalizedOptions?.duration ?? 1000, actions: normalizedOptions?.actions });
  }

  info(message: string, options?: number | ToastOptions) {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options;
    return this.show(message, 'info', { duration: normalizedOptions?.duration ?? 1000, actions: normalizedOptions?.actions });
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

