// Business Manager Feature Module Exports

// Error Boundary
export { BusinessErrorBoundary } from './ErrorBoundary';

// Components
export { BusinessManagerDashboard } from './components/BusinessManagerDashboard';
export { default as BusinessNav } from './components/BusinessNav';
export { default as ContractLibrary } from './components/ContractLibrary';
export { default as ContractEditor } from './components/ContractEditor';
export { default as RedFlagReport } from './components/RedFlagReport';
export { default as InvoiceDashboard } from './components/InvoiceDashboard';
export { default as InvoiceEditor } from './components/InvoiceEditor';
export { default as RevenueMix } from './components/RevenueMix';
export { default as DiversificationGoals } from './components/DiversificationGoals';
export { default as TaxSummary } from './components/TaxSummary';
export { default as ExpenseTracker } from './components/ExpenseTracker';

// Hooks
export {
  useContractTemplates,
  useContractTemplate,
  useContracts,
  useCreateContract,
  useUpdateContract,
  useAnalyzeContract,
} from './hooks/useContracts';

export {
  useBusinessInvoices,
  useBusinessInvoice,
  useCreateBusinessInvoice,
  useUpdateInvoiceStatus,
  useGeneratePaymentLink,
} from './hooks/useBusinessInvoices';

export {
  useRevenueBreakdown,
  useRevenueRisk,
  useDiversificationGoals,
  useUpdateDiversificationGoals,
  useAddRevenueEntry,
} from './hooks/useRevenue';

export { useTaxSummary, useTaxCategories, useCreateTaxCategory } from './hooks/useTax';

export { useExpenses, useAddExpense } from './hooks/useExpenses';

// API Services
export { contractsApi } from './services/contractsApi';
export { invoicesApi } from './services/invoicesApi';
export { revenueApi } from './services/revenueApi';
export { taxApi } from './services/taxApi';

// Types
export type {
  ApiResponse as BusinessApiResponse,
  PaginatedData,
  RevenueBreakdownEntry,
  RevenueRisk,
  QuarterlyTaxSummary,
  CreateContractPayload,
  UpdateContractPayload,
  CreateInvoicePayload,
  CreateExpensePayload,
  CreateRevenueEntryPayload,
  BusinessTab,
} from './types';
