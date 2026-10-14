/** The TanStack Query keys of the admin panel. In their own file so the server layout can fill the first one before the page loads. */
export const adminKeys = {
  all: ["admin"] as const,
  dashboard: ["admin", "dashboard"] as const,
  analytics: ["admin", "analytics"] as const,
  security: ["admin", "security"] as const,
  expensesAll: ["admin", "expenses"] as const,
  expenses: (month: string) => ["admin", "expenses", month] as const,
  usersAll: ["admin", "users"] as const,
  users: (filter: string, q: string) => ["admin", "users", filter, q] as const,
  standIns: ["admin", "stand-ins"] as const,
  uploadsAll: ["admin", "uploads"] as const,
  uploads: (standInId: string, owner: string, status: string) =>
    ["admin", "uploads", standInId, owner, status] as const,
};
