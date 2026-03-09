import React, { useState } from 'react';
import type { BusinessTab } from '../types';
import BusinessNav from './BusinessNav';
import ContractLibrary from './ContractLibrary';
import ContractEditor from './ContractEditor';
import InvoiceDashboard from './InvoiceDashboard';
import InvoiceEditor from './InvoiceEditor';
import RevenueMix from './RevenueMix';
import TaxSummary from './TaxSummary';
import ExpenseTracker from './ExpenseTracker';
import DiversificationGoals from './DiversificationGoals';

export const BusinessManagerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BusinessTab>('revenue');
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [editingContract, setEditingContract] = useState<string | null>(null);

  const handleTabChange = (tab: BusinessTab) => {
    setActiveTab(tab);
    setEditingInvoice(false);
    setEditingContract(null);
  };

  const renderTabPanel = (): React.ReactNode => {
    switch (activeTab) {
      case 'contracts':
        if (editingContract) {
          return (
            <ContractEditor
              templateId={editingContract}
              onCancel={() => setEditingContract(null)}
              onSaved={() => setEditingContract(null)}
            />
          );
        }
        return <ContractLibrary onSelectTemplate={(id) => setEditingContract(id)} />;
      case 'invoices':
        if (editingInvoice) {
          return (
            <InvoiceEditor
              onCancel={() => setEditingInvoice(false)}
              onSaved={() => setEditingInvoice(false)}
            />
          );
        }
        return <InvoiceDashboard onCreateNew={() => setEditingInvoice(true)} />;
      case 'revenue':
        return (
          <>
            <RevenueMix />
            <DiversificationGoals />
          </>
        );
      case 'tax':
        return (
          <>
            <TaxSummary />
            <ExpenseTracker />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Business Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contracts, invoices, revenue, and tax tools.
        </p>
      </div>
      <BusinessNav activeTab={activeTab} onTabChange={handleTabChange} />
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={activeTab}>
        {renderTabPanel()}
      </div>
    </div>
  );
};
