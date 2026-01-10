// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/login`,

  // Dashboard
  DASHBOARD_OVERVIEW: `${API_BASE_URL}/dashboard/overview`,

  // QA
  QA_ENTRY: `${API_BASE_URL}/qa/entry`,
  QA_HISTORY: `${API_BASE_URL}/qa/history`,
  QA_LOG: `${API_BASE_URL}/qa/log`,

  // Packaging
  PKG_ENTRY: `${API_BASE_URL}/pkg/entry`,
  PKG_HISTORY: `${API_BASE_URL}/pkg/history`,

  // Master data
  WORKERS: `${API_BASE_URL}/workers`,
  PRICES: `${API_BASE_URL}/prices`,
  ORDERS: `${API_BASE_URL}/orders`,
  USERS: `${API_BASE_URL}/users`,
  ORDERS_SEARCH: `${API_BASE_URL}/orders/search`,

  // Import
  IMPORT_EXCEL: `${API_BASE_URL}/import/excel`,
  ADMIN_SQL: `${API_BASE_URL}/admin/sql`,
};
