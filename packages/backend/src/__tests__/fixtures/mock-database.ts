/**
 * Mock Database for Testing
 * Simple in-memory database for integration tests
 */

export function createMockDatabase(config?: { real?: boolean }): any {
  const data = new Map<string, Map<string, any>>();

  return {
    query: async (sql: string, params?: any[]) => {
      return { rows: [], rowCount: 0 };
    },

    transaction: async <T>(callback: (trx: any) => Promise<T>): Promise<T> => {
      return callback({
        query: async (sql: string, params?: any[]) => {
          return { rows: [], rowCount: 0 };
        },
        commit: async () => {},
        rollback: async () => {}
      });
    },

    insert: async (table: string, record: any) => {
      if (!data.has(table)) {
        data.set(table, new Map());
      }
      const tableData = data.get(table)!;
      const id = record.id || `mock-${Date.now()}`;
      tableData.set(id, { ...record, id });
      return { ...record, id };
    },

    findById: async (table: string, id: string) => {
      const tableData = data.get(table);
      return tableData?.get(id) || null;
    },

    findAll: async (table: string) => {
      const tableData = data.get(table);
      return tableData ? Array.from(tableData.values()) : [];
    },

    update: async (table: string, id: string, updates: any) => {
      const tableData = data.get(table);
      if (!tableData) return null;
      const record = tableData.get(id);
      if (!record) return null;
      const updated = { ...record, ...updates };
      tableData.set(id, updated);
      return updated;
    },

    delete: async (table: string, id: string) => {
      const tableData = data.get(table);
      if (!tableData) return false;
      return tableData.delete(id);
    },

    clear: () => {
      data.clear();
    }
  };
}
