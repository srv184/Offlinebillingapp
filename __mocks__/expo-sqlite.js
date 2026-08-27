const SQLite = {
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    closeAsync: async () => {},
    withTransactionAsync: async (task) => task(),
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
    runAsync: async () => ({}),
  }),
};

module.exports = SQLite;
