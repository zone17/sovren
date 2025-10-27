/**
 * Modal Manager Component
 * Centralized modal management using Redux
 * Following Elite Engineering Standards
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectModal } from '@/store';
import { closeModal } from '@/store/slices/uiSlice';
import { motion, AnimatePresence } from 'framer-motion';

// Import modal components
import { PaymentModal } from '../modals/PaymentModal';
import { CreatorModal } from '../modals/CreatorModal';
import { ContentModal } from '../modals/ContentModal';
import { SettingsModal } from '../modals/SettingsModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';

// Modal component map
const MODAL_COMPONENTS = {
  payment: PaymentModal,
  creator: CreatorModal,
  content: ContentModal,
  settings: SettingsModal,
  confirmation: ConfirmationModal,
} as const;

interface ModalManagerProps {
  containerId?: string;
}

export const ModalManager: React.FC<ModalManagerProps> = ({
  containerId = 'modal-root',
}) => {
  const modal = useAppSelector(selectModal);
  const dispatch = useAppDispatch();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle close modal
  const handleClose = useCallback(() => {
    dispatch(closeModal());
  }, [dispatch]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.isOpen) {
        handleClose();
      }
    };

    if (modal.isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [modal.isOpen, handleClose]);

  // Focus management
  useEffect(() => {
    if (modal.isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus modal after animation
      setTimeout(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 100);
    } else {
      // Restore focus when modal closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
  }, [modal.isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (modal.isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
  }, [modal.isOpen]);

  // Get modal container
  const modalContainer = document.getElementById(containerId);
  if (!modalContainer) {
    console.warn(`Modal container with id "${containerId}" not found`);
    return null;
  }

  // Get modal component
  const ModalComponent = modal.type ? MODAL_COMPONENTS[modal.type] : null;

  return createPortal(
    <AnimatePresence>
      {modal.isOpen && ModalComponent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <ModalComponent
              data={modal.data}
              onClose={handleClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    modalContainer
  );
};

// Hook for opening modals
export const useModal = () => {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectModal);

  const openModal = useCallback(
    (type: typeof modal.type, data?: any) => {
      if (type) {
        dispatch({ type: 'ui/openModal', payload: { type, data } });
      }
    },
    [dispatch]
  );

  const closeModal = useCallback(() => {
    dispatch({ type: 'ui/closeModal' });
  }, [dispatch]);

  return {
    isOpen: modal.isOpen,
    modalType: modal.type,
    modalData: modal.data,
    openModal,
    closeModal,
  };
};

// Modal stacking context for nested modals
interface ModalStackItem {
  type: typeof MODAL_COMPONENTS[keyof typeof MODAL_COMPONENTS];
  data?: any;
}

const ModalStackContext = React.createContext<{
  stack: ModalStackItem[];
  pushModal: (modal: ModalStackItem) => void;
  popModal: () => void;
}>({
  stack: [],
  pushModal: () => {},
  popModal: () => {},
});

export const ModalStackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stack, setStack] = React.useState<ModalStackItem[]>([]);

  const pushModal = useCallback((modal: ModalStackItem) => {
    setStack((prev) => [...prev, modal]);
  }, []);

  const popModal = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  return (
    <ModalStackContext.Provider value={{ stack, pushModal, popModal }}>
      {children}
      {/* Render stacked modals with increasing z-index */}
      {stack.map((modal, index) => (
        <div
          key={index}
          style={{ zIndex: 50 + index * 10 }}
          className="fixed inset-0"
        >
          {/* Render modal from stack */}
        </div>
      ))}
    </ModalStackContext.Provider>
  );
};

export const useModalStack = () => React.useContext(ModalStackContext);