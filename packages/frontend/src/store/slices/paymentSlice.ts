import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Payment } from '@sovren/shared';
import type { PaymentState } from '../types';

const initialState: PaymentState = {
  payments: [],
  currentPayment: null,
  loading: false,
  error: null,
};

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    setPayments: (state, action: PayloadAction<Payment[]>) => {
      state.payments = action.payload;
      state.error = null;
    },
    setCurrentPayment: (state, action: PayloadAction<Payment>) => {
      state.currentPayment = action.payload;
      state.error = null;
    },
    addPayment: (state, action: PayloadAction<Payment>) => {
      state.payments.push(action.payload);
      state.error = null;
    },
    updatePayment: (state, action: PayloadAction<Payment>) => {
      const index = state.payments.findIndex((payment) => payment.id === action.payload.id);
      if (index !== -1) {
        state.payments[index] = action.payload;
      }
      if (state.currentPayment?.id === action.payload.id) {
        state.currentPayment = action.payload;
      }
      state.error = null;
    },
    deletePayment: (state, action: PayloadAction<string>) => {
      state.payments = state.payments.filter((payment) => payment.id !== action.payload);
      if (state.currentPayment?.id === action.payload) {
        state.currentPayment = null;
      }
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearCurrentPayment: (state) => {
      state.currentPayment = null;
      state.error = null;
    },
  },
});

export const {
  setPayments,
  setCurrentPayment,
  addPayment,
  updatePayment,
  deletePayment,
  setLoading,
  setError,
  clearCurrentPayment,
} = paymentSlice.actions;

export default paymentSlice.reducer;
