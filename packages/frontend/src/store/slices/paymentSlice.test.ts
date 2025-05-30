import type { Payment, PaymentState } from '../../types';
import paymentReducer, {
  addPayment,
  clearCurrentPayment,
  deletePayment,
  setCurrentPayment,
  setError,
  setLoading,
  setPayments,
  updatePayment,
} from './paymentSlice';

describe('paymentSlice', () => {
  const initialState: PaymentState = {
    payments: [],
    currentPayment: null,
    loading: false,
    error: null,
  };

  const mockPayment: Payment = {
    id: '1',
    amount: 1000,
    currency: 'BTC',
    status: 'completed',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_id: 'user1',
    post_id: 'post1',
    invoice: 'invoice123',
    preimage: 'preimage123',
  };

  const mockPayment2: Payment = {
    id: '2',
    amount: 2000,
    currency: 'BTC',
    status: 'pending',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    user_id: 'user2',
    post_id: 'post2',
  };

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(paymentReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('setPayments action', () => {
    it('should set payments array and clear error', () => {
      const payments = [mockPayment, mockPayment2];
      const action = setPayments(payments);
      const newState = paymentReducer(initialState, action);

      expect(newState.payments).toEqual(payments);
      expect(newState.error).toBe(null);
    });
  });

  describe('setCurrentPayment action', () => {
    it('should set current payment and clear error', () => {
      const action = setCurrentPayment(mockPayment);
      const newState = paymentReducer(initialState, action);

      expect(newState.currentPayment).toEqual(mockPayment);
      expect(newState.error).toBe(null);
    });
  });

  describe('addPayment action', () => {
    it('should add payment to the array and clear error', () => {
      const action = addPayment(mockPayment);
      const newState = paymentReducer(initialState, action);

      expect(newState.payments).toEqual([mockPayment]);
      expect(newState.error).toBe(null);
    });

    it('should add payment to existing array', () => {
      const stateWithPayments: PaymentState = {
        ...initialState,
        payments: [mockPayment],
      };

      const action = addPayment(mockPayment2);
      const newState = paymentReducer(stateWithPayments, action);

      expect(newState.payments).toEqual([mockPayment, mockPayment2]);
    });
  });

  describe('updatePayment action', () => {
    it('should update payment in array', () => {
      const stateWithPayments: PaymentState = {
        ...initialState,
        payments: [mockPayment, mockPayment2],
      };

      const updatedPayment: Payment = {
        ...mockPayment,
        status: 'failed',
        amount: 1500,
      };

      const action = updatePayment(updatedPayment);
      const newState = paymentReducer(stateWithPayments, action);

      expect(newState.payments[0]).toEqual(updatedPayment);
      expect(newState.payments[1]).toEqual(mockPayment2);
      expect(newState.error).toBe(null);
    });

    it('should update current payment if it matches', () => {
      const stateWithCurrentPayment: PaymentState = {
        ...initialState,
        payments: [mockPayment],
        currentPayment: mockPayment,
      };

      const updatedPayment: Payment = {
        ...mockPayment,
        status: 'failed',
      };

      const action = updatePayment(updatedPayment);
      const newState = paymentReducer(stateWithCurrentPayment, action);

      expect(newState.currentPayment).toEqual(updatedPayment);
      expect(newState.payments[0]).toEqual(updatedPayment);
    });

    it('should not crash if payment not found', () => {
      const action = updatePayment(mockPayment);
      const newState = paymentReducer(initialState, action);

      expect(newState.payments).toEqual([]);
      expect(newState.error).toBe(null);
    });
  });

  describe('deletePayment action', () => {
    it('should remove payment from array', () => {
      const stateWithPayments: PaymentState = {
        ...initialState,
        payments: [mockPayment, mockPayment2],
      };

      const action = deletePayment('1');
      const newState = paymentReducer(stateWithPayments, action);

      expect(newState.payments).toEqual([mockPayment2]);
      expect(newState.error).toBe(null);
    });

    it('should clear current payment if it matches deleted ID', () => {
      const stateWithCurrentPayment: PaymentState = {
        ...initialState,
        payments: [mockPayment],
        currentPayment: mockPayment,
      };

      const action = deletePayment('1');
      const newState = paymentReducer(stateWithCurrentPayment, action);

      expect(newState.payments).toEqual([]);
      expect(newState.currentPayment).toBe(null);
    });
  });

  describe('setLoading action', () => {
    it('should set loading to true', () => {
      const action = setLoading(true);
      const newState = paymentReducer(initialState, action);

      expect(newState.loading).toBe(true);
    });

    it('should set loading to false', () => {
      const loadingState: PaymentState = {
        ...initialState,
        loading: true,
      };

      const action = setLoading(false);
      const newState = paymentReducer(loadingState, action);

      expect(newState.loading).toBe(false);
    });
  });

  describe('setError action', () => {
    it('should set error and stop loading', () => {
      const loadingState: PaymentState = {
        ...initialState,
        loading: true,
      };

      const errorMessage = 'Payment failed';
      const action = setError(errorMessage);
      const newState = paymentReducer(loadingState, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
    });
  });

  describe('clearCurrentPayment action', () => {
    it('should clear current payment and error', () => {
      const stateWithCurrentPayment: PaymentState = {
        ...initialState,
        currentPayment: mockPayment,
        error: 'Some error',
      };

      const action = clearCurrentPayment();
      const newState = paymentReducer(stateWithCurrentPayment, action);

      expect(newState.currentPayment).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.payments).toEqual([]); // Should not affect payments array
    });
  });

  describe('Action creators', () => {
    it('should create correct action types', () => {
      expect(setPayments([]).type).toBe('payment/setPayments');
      expect(setCurrentPayment(mockPayment).type).toBe('payment/setCurrentPayment');
      expect(addPayment(mockPayment).type).toBe('payment/addPayment');
      expect(updatePayment(mockPayment).type).toBe('payment/updatePayment');
      expect(deletePayment('1').type).toBe('payment/deletePayment');
      expect(setLoading(true).type).toBe('payment/setLoading');
      expect(setError('error').type).toBe('payment/setError');
      expect(clearCurrentPayment().type).toBe('payment/clearCurrentPayment');
    });
  });
});
