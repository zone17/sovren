/**
 * 🏪 **TYPED REDUX HOOKS**
 *
 * Elite Engineering Standards:
 * ✅ Type-safe Redux hooks for the application
 * ✅ Prevents type errors in components
 * ✅ Consistent state access patterns
 */

import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
