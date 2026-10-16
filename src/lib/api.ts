const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type PurchaseItem = {
  _id?: string;
  partNo: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  billedQty?: number;
  unit?: string;
  scheduleDate?: string;
  deliverDate?: string;
};

export type Party = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  hsnCode?: string;
  gstPercentage?: number;
  address: string;
  city: string;
  state: string;
  notes?: string;
  active?: boolean;
  createdAt?: string;
};

export type Company = {
  _id: string;
  name: string;
  logo: string;
  address: string;
  gstin: string;
  email: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  panNo: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RecycleBinItem = {
  id: string;
  type: "customers" | "suppliers" | "purchases" | "sales-invoices";
  typeLabel: string;
  name: string;
  deletedAt?: string | null;
  meta?: string;
};

export type PurchaseOrder = {
  _id: string;
  poNumber: string;
  customer?: string;
  customerId?: string | null;
  /** @deprecated use customer — kept for older records */
  supplier: string;
  supplierId?: string | null;
  poDate: string;
  status: "open" | "partial" | "closed" | "cancelled";
  items: PurchaseItem[];
  totalAmount: number;
  notes?: string;
  createdAt?: string;
};

/** Display name for the party on a customer PO */
export function poCustomerName(po: PurchaseOrder) {
  return po.customer || po.supplier || "—";
}

export type SalesInvoiceItem = {
  purchaseOrder?: string;
  poNumber?: string;
  poItemId: string;
  partNo: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
};

export type SalesInvoice = {
  _id: string;
  billNo: string;
  purchaseOrder?: PurchaseOrder | string | null;
  purchaseOrders?: Array<PurchaseOrder | string>;
  poNumber: string;
  poNumbers?: string[];
  customerId?: string | null;
  customerName?: string;
  billDate: string;
  items: SalesInvoiceItem[];
  totalAmount: number;
  paymentReceived: boolean;
  paymentDate?: string;
  notes?: string;
  createdAt?: string;
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("winfab_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),
  getCompany: () => request<Company>("/company"),
  updateCompany: (body: Record<string, unknown>) =>
    request<Company>("/company", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getCustomers: () => request<Party[]>("/customers"),
  getCustomer: (id: string) => request<Party>(`/customers/${id}`),
  createCustomer: (body: Record<string, unknown>) =>
    request<Party>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: string, body: Record<string, unknown>) =>
    request<Party>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCustomer: (id: string) =>
    request<{ message: string }>(`/customers/${id}`, { method: "DELETE" }),
  getSuppliers: () => request<Party[]>("/suppliers"),
  createSupplier: (body: Record<string, unknown>) =>
    request<Party>("/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSupplier: (id: string, body: Record<string, unknown>) =>
    request<Party>(`/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSupplier: (id: string) =>
    request<{ message: string }>(`/suppliers/${id}`, { method: "DELETE" }),
  getPurchases: () => request<PurchaseOrder[]>("/purchases"),
  getPurchase: (id: string) => request<PurchaseOrder>(`/purchases/${id}`),
  createPurchase: (body: Record<string, unknown>) =>
    request<PurchaseOrder>("/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePurchase: (id: string, body: Record<string, unknown>) =>
    request<PurchaseOrder>(`/purchases/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePurchase: (id: string) =>
    request<{ message: string }>(`/purchases/${id}`, { method: "DELETE" }),
  getSalesInvoices: (poId?: string) =>
    request<SalesInvoice[]>(
      poId ? `/sales-invoices?poId=${poId}` : "/sales-invoices"
    ),
  getSalesInvoice: (id: string) =>
    request<SalesInvoice>(`/sales-invoices/${id}`),
  createSalesInvoice: (body: Record<string, unknown>) =>
    request<SalesInvoice>("/sales-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSalesInvoice: (id: string, body: Record<string, unknown>) =>
    request<SalesInvoice>(`/sales-invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSalesInvoice: (id: string) =>
    request<{ message: string }>(`/sales-invoices/${id}`, { method: "DELETE" }),
  getRecycleBin: () =>
    request<{
      items: RecycleBinItem[];
      counts: {
        customers: number;
        suppliers: number;
        purchases: number;
        salesInvoices: number;
        total: number;
      };
    }>("/recycle-bin"),
  restoreRecycleBinItem: (type: string, id: string) =>
    request<{ message: string }>(`/recycle-bin/${type}/${id}/restore`, {
      method: "POST",
    }),
  purgeRecycleBinItem: (type: string, id: string) =>
    request<{ message: string }>(`/recycle-bin/${type}/${id}`, {
      method: "DELETE",
    }),
};

export function remainingQty(item: PurchaseItem) {
  return Math.max(0, (item.qty || 0) - (item.billedQty || 0));
}

export function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}
