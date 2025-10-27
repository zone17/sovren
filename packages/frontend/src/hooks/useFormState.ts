/**
 * Form State Management Hook
 * Intelligent form state management with Redux for complex forms
 * Following Elite Engineering Standards
 */

import { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setFormData,
  updateFormField,
  clearFormData,
} from '@/store/slices/uiSlice';

export type FormComplexity = 'simple' | 'complex';

interface UseFormStateOptions<T> {
  formId: string;
  initialValues: T;
  complexity?: FormComplexity;
  persistToRedux?: boolean;
  validation?: (values: T) => Record<string, string>;
  onSubmit?: (values: T) => void | Promise<void>;
}

/**
 * Decision criteria for form state location:
 *
 * Use LOCAL STATE (useState) for:
 * - Simple forms (login, search, single-field forms)
 * - Forms that don't need persistence
 * - Forms that complete in one session
 * - Forms with < 5 fields
 *
 * Use REDUX STATE for:
 * - Multi-step forms
 * - Forms that need persistence across navigation
 * - Complex forms with > 10 fields
 * - Forms with draft/auto-save functionality
 * - Creator onboarding forms
 * - Content editor forms
 */
export function useFormState<T extends Record<string, any>>({
  formId,
  initialValues,
  complexity = 'simple',
  persistToRedux = complexity === 'complex',
  validation,
  onSubmit,
}: UseFormStateOptions<T>) {
  const dispatch = useAppDispatch();

  // Get Redux form data if using Redux
  const reduxFormData = useAppSelector(
    (state) => (persistToRedux ? state.ui.formData[formId] : null) as T | null
  );

  // Local state for simple forms or as a buffer for Redux forms
  const [localValues, setLocalValues] = useState<T>(
    reduxFormData || initialValues
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync with Redux if using Redux persistence
  useEffect(() => {
    if (persistToRedux && !reduxFormData) {
      dispatch(setFormData({ formId, data: initialValues }));
    }
  }, [persistToRedux, formId, initialValues, reduxFormData, dispatch]);

  // Get current values (from Redux or local state)
  const values = persistToRedux && reduxFormData ? reduxFormData : localValues;

  // Handle field change
  const handleChange = useCallback(
    (field: keyof T, value: any) => {
      setIsDirty(true);

      if (persistToRedux) {
        // Update Redux state
        dispatch(updateFormField({ formId, field: field as string, value }));
      } else {
        // Update local state
        setLocalValues((prev) => ({
          ...prev,
          [field]: value,
        }));
      }

      // Clear error for this field
      if (errors[field as string]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as string];
          return next;
        });
      }
    },
    [formId, persistToRedux, errors, dispatch]
  );

  // Handle field blur
  const handleBlur = useCallback((field: keyof T) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  }, []);

  // Validate form
  const validate = useCallback(() => {
    if (!validation) return true;

    const newErrors = validation(values);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validation, values]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      );
      setTouched(allTouched);

      // Validate
      if (!validate()) {
        return;
      }

      setIsSubmitting(true);

      try {
        if (onSubmit) {
          await onSubmit(values);
        }

        // Clear form after successful submission
        if (persistToRedux) {
          dispatch(clearFormData(formId));
        } else {
          setLocalValues(initialValues);
        }

        setIsDirty(false);
        setTouched({});
        setErrors({});
      } catch (error) {
        console.error('Form submission error:', error);
        setErrors({ form: 'Submission failed. Please try again.' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, onSubmit, persistToRedux, formId, initialValues, dispatch]
  );

  // Reset form
  const reset = useCallback(() => {
    if (persistToRedux) {
      dispatch(setFormData({ formId, data: initialValues }));
    } else {
      setLocalValues(initialValues);
    }

    setErrors({});
    setTouched({});
    setIsDirty(false);
    setIsSubmitting(false);
  }, [persistToRedux, formId, initialValues, dispatch]);

  // Set field value programmatically
  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      handleChange(field, value);
    },
    [handleChange]
  );

  // Set multiple field values
  const setFieldValues = useCallback(
    (updates: Partial<T>) => {
      Object.entries(updates).forEach(([field, value]) => {
        handleChange(field as keyof T, value);
      });
    },
    [handleChange]
  );

  // Get field props for input binding
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      name: field,
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleChange(field, e.target.value),
      onBlur: () => handleBlur(field),
      error: touched[field as string] ? errors[field as string] : undefined,
    }),
    [values, handleChange, handleBlur, touched, errors]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid: Object.keys(errors).length === 0,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldValues,
    getFieldProps,
    validate,
  };
}

/**
 * Form complexity analyzer
 * Helps decide whether to use Redux or local state
 */
export function analyzeFormComplexity(fields: string[]): FormComplexity {
  const criteria = {
    fieldCount: fields.length,
    hasFileUpload: fields.some((f) => f.includes('file') || f.includes('image')),
    hasArrayFields: fields.some((f) => f.includes('[]')),
    hasNestedFields: fields.some((f) => f.includes('.')),
  };

  // Complex if any of these conditions are met
  if (
    criteria.fieldCount > 10 ||
    criteria.hasFileUpload ||
    criteria.hasArrayFields ||
    criteria.hasNestedFields
  ) {
    return 'complex';
  }

  return 'simple';
}

/**
 * Form state guidelines
 */
export const FORM_STATE_GUIDELINES = {
  // Simple forms - use local state
  simple: [
    'LoginForm',
    'SearchForm',
    'CommentForm',
    'NewsletterSignupForm',
    'ContactForm',
  ],

  // Complex forms - use Redux
  complex: [
    'CreatorOnboardingForm',
    'ContentEditorForm',
    'PaymentSetupForm',
    'ProfileSettingsForm',
    'MultiStepWizardForm',
  ],

  // Decision matrix
  decisionMatrix: {
    fieldCount: {
      '< 5': 'local',
      '5-10': 'consider context',
      '> 10': 'redux',
    },
    persistence: {
      'not needed': 'local',
      'across navigation': 'redux',
      'draft/autosave': 'redux',
    },
    complexity: {
      'single step': 'local',
      'multi step': 'redux',
      'wizard': 'redux',
    },
  },
};