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

export type PurchaseOrder = {
  _id: string;
  poNumber: string;
  supplier: string;
  poDate: string;
  status: "open" | "partial" | "closed" | "cancelled";
  items: PurchaseItem[];
  totalAmount: number;
  notes?: string;
  createdAt?: string;
};

export type SalesInvoiceItem = {
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
  purchaseOrder: PurchaseOrder | string;
  poNumber: string;
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
