import { useCallback } from 'react';

interface ToastOptions {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}

export const useToast = () => {
  const toast = useCallback((options: ToastOptions) => {
    // Simple console implementation - can be replaced with actual toast library
    console.log(`[${options.variant || 'default'}] ${options.title}: ${options.description}`);
  }, []);

  return { toast };
};
