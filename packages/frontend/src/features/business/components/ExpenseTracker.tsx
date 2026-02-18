import React, { useState } from 'react';
import { useExpenses, useAddExpense } from '../hooks/useExpenses';
import { useTaxCategories } from '../hooks/useTax';
import type { CreateExpensePayload } from '../types';

function formatSats(sats: number): string {
  return sats.toLocaleString() + ' sats';
}

const ExpenseTracker: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const { data: expenses, isLoading } = useExpenses(
    categoryFilter !== 'all' ? { categoryId: categoryFilter } : undefined
  );
  const { data: categories } = useTaxCategories();
  const addMutation = useAddExpense();

  const [form, setForm] = useState<CreateExpensePayload>({
    categoryId: '',
    description: '',
    amountSats: 0,
    expenseDate: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || form.amountSats <= 0) return;
    addMutation.mutate(
      { ...form, categoryId: form.categoryId || undefined },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({
            categoryId: '',
            description: '',
            amountSats: 0,
            expenseDate: new Date().toISOString().split('T')[0],
          });
        },
      }
    );
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amountSats, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-40 rounded bg-gray-200" />
        <div className="h-48 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Expenses</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Total: {formatSats(totalExpenses)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter expenses by category"
          >
            <option value="all">All Categories</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? 'Cancel' : 'Add Expense'}
          </button>
        </div>
      </div>

      {/* Add expense form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3"
          aria-label="Add new expense"
        >
          <h5 className="text-sm font-medium text-gray-900">New Expense</h5>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="expense-description" className="block text-xs font-medium text-gray-700">
                Description
              </label>
              <input
                id="expense-description"
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="What was purchased?"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="expense-category" className="block text-xs font-medium text-gray-700">
                Category
              </label>
              <select
                id="expense-category"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.categoryId}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">Uncategorized</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-amount" className="block text-xs font-medium text-gray-700">
                Amount (sats)
              </label>
              <input
                id="expense-amount"
                type="number"
                min="1"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.amountSats || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, amountSats: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label htmlFor="expense-date" className="block text-xs font-medium text-gray-700">
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.expenseDate}
                onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
            disabled={addMutation.isPending}
            aria-busy={addMutation.isPending}
          >
            {addMutation.isPending ? 'Adding...' : 'Add Expense'}
          </button>

          {addMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              Failed to add expense. Please try again.
            </p>
          )}
        </form>
      )}

      {/* Expense list */}
      {expenses && expenses.length > 0 ? (
        <ul
          className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white"
          role="list"
          aria-label="Expense list"
        >
          {expenses.map((expense) => {
            const category = categories?.find((c) => c.id === expense.categoryId);
            return (
              <li key={expense.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {expense.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(expense.expenseDate).toLocaleDateString()}
                    {category && ` · ${category.name}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900">
                    {formatSats(expense.amountSats)}
                  </p>
                  {expense.usdAtTime != null && (
                    <p className="text-xs text-gray-500">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(expense.usdAtTime)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No expenses recorded yet.</p>
      )}
    </div>
  );
};

export default ExpenseTracker;
