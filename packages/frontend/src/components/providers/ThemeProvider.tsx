/**
 * Theme Provider Component
 * Uses Redux for theme state management
 * Following Elite Engineering Standards
 */

import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectTheme } from '@/store';
import { hydrateFromStorage } from '@/store/slices/uiSlice';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();

  // Hydrate theme from localStorage on mount
  useEffect(() => {
    dispatch(hydrateFromStorage());
  }, [dispatch]);

  // Apply theme to document — theme is always 'dark' or 'light' (no 'system')
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    // Add current theme class
    root.classList.add(theme);

    // Set CSS variables for theme
    root.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');
    }
  }, [theme]);

  return <>{children}</>;
};

// Theme toggle hook
export const useTheme = () => {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();

  const setTheme = React.useCallback(
    (newTheme: 'light' | 'dark') => {
      dispatch({ type: 'ui/setTheme', payload: newTheme });
    },
    [dispatch]
  );

  const toggleTheme = React.useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
  };
};
