// Client API para comunicação com o backend KING'S

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('kings_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || 'Erro na requisição com o servidor';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // System Status & Database Diagnostics
  getStatus: () => request('/status'),
  syncDatabase: () => request('/admin/sync-database', { method: 'POST' }),

  // Auth
  login: (pin) => request('/auth/login', { method: 'POST', body: JSON.stringify({ pin }) }),
  checkAuth: () => request('/auth/check'),

  // Businesses
  getBusinesses: () => request('/businesses'),
  updateBusiness: (id, data) => request(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleBusinessStatus: (id) => request(`/businesses/${id}/toggle-status`, { method: 'POST' }),
  toggleBusinessActive: (id) => request(`/businesses/${id}/toggle-active`, { method: 'POST' }),

  // Public Menu
  getPublicMenu: () => request('/public/menu'),
  createPublicOrder: (orderData) => request('/public/orders', { method: 'POST', body: JSON.stringify(orderData) }),

  // Orders
  getOrders: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/orders${search ? `?${search}` : ''}`);
  },
  getOrderById: (id) => request(`/orders/${id}`),
  updateOrderStatus: (id, status) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updatePaymentStatus: (id, payment_status) => request(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ payment_status }) }),
  createManualOrder: (orderData) => request('/orders/manual', { method: 'POST', body: JSON.stringify(orderData) }),

  // Products & Menu Manager
  getProducts: (businessId) => request(`/products${businessId ? `?business_id=${businessId}` : ''}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: (businessId) => request(`/categories${businessId ? `?business_id=${businessId}` : ''}`),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // One-click Reset Official Burger Menu
  resetBurguerMenu: () => request('/menu/reset-burguer', { method: 'POST' }),

  // Coupons (Sistema 100% Personalizável)
  getCoupons: () => request('/coupons'),
  createCoupon: (data) => request('/coupons', { method: 'POST', body: JSON.stringify(data) }),
  updateCoupon: (id, data) => request(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCoupon: (id) => request(`/coupons/${id}`, { method: 'DELETE' }),
  toggleCoupon: (id) => request(`/coupons/${id}/toggle`, { method: 'POST' }),
  validateCoupon: (payload) => request('/public/coupons/validate', { method: 'POST', body: JSON.stringify(payload) }),

  // Ingredients
  getIngredients: (businessId) => request(`/ingredients${businessId ? `?business_id=${businessId}` : ''}`),
  createIngredient: (data) => request('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
  updateIngredient: (id, data) => request(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIngredient: (id) => request(`/ingredients/${id}`, { method: 'DELETE' }),

  // Recipes / Technical Sheets
  getRecipe: (productId) => request(`/recipes/${productId}`),
  saveRecipe: (productId, items) => request(`/recipes/${productId}`, { method: 'POST', body: JSON.stringify({ items }) }),

  // Stock
  getStockMovements: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/stock/movements${search ? `?${search}` : ''}`);
  },
  createStockMovement: (data) => request('/stock/movement', { method: 'POST', body: JSON.stringify(data) }),

  // CMV
  getCmvReport: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/cmv${search ? `?${search}` : ''}`);
  },

  // Finance & DRE
  getDre: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/finance/dre${search ? `?${search}` : ''}`);
  },
  getExpenses: (businessId) => request(`/finance/expenses${businessId ? `?business_id=${businessId}` : ''}`),
  createExpense: (data) => request('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id) => request(`/finance/expenses/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/dashboard${search ? `?${search}` : ''}`);
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Delivery Zones
  getDeliveryZones: () => request('/delivery-zones'),
  createDeliveryZone: (data) => request('/delivery-zones', { method: 'POST', body: JSON.stringify(data) }),
  updateDeliveryZone: (id, data) => request(`/delivery-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeliveryZone: (id) => request(`/delivery-zones/${id}`, { method: 'DELETE' }),

  // Couriers / Motoboys
  getCouriers: () => request('/couriers'),
  createCourier: (data) => request('/couriers', { method: 'POST', body: JSON.stringify(data) }),
  updateCourier: (id, data) => request(`/couriers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourier: (id) => request(`/couriers/${id}`, { method: 'DELETE' }),
  assignOrderCourier: (orderId, courierId) => request(`/orders/${orderId}/courier`, { method: 'PATCH', body: JSON.stringify({ courier_id: courierId }) }),

  // Cash Shifts (Frente de Caixa / Gaveta)
  getCashCurrent: () => request('/cash/current'),
  openCashShift: (data) => request('/cash/open', { method: 'POST', body: JSON.stringify(data) }),
  recordCashMovement: (data) => request('/cash/movement', { method: 'POST', body: JSON.stringify(data) }),
  closeCashShift: (data) => request('/cash/close', { method: 'POST', body: JSON.stringify(data) }),
  getCashHistory: () => request('/cash/history'),

  // Inventory Physical Audits (Balanço Físico)
  getInventoryAuditTemplate: (businessId) => request(`/inventory/audit-template${businessId ? `?business_id=${businessId}` : ''}`),
  submitInventoryAudit: (data) => request('/inventory/audit-submit', { method: 'POST', body: JSON.stringify(data) }),
  getInventoryAudits: () => request('/inventory/audits'),

  // Advanced Analytics & Reports
  getAnalytics: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/reports/analytics${search ? `?${search}` : ''}`);
  },

  // Customers (CRM)
  getCustomers: () => request('/customers'),

  // KDS (Kitchen Display System)
  getKdsOrders: () => request('/kds/orders'),
};
