"use client";

import { useCallback } from "react";
import PartyMasterPage from "@/components/PartyMasterPage";
import { api } from "@/lib/api";

export default function SuppliersPage() {
  const loadItems = useCallback(() => api.getSuppliers(), []);

  return (
    <PartyMasterPage
      title="Suppliers"
      addLabel="Add Supplier"
      searchPlaceholder="Search by name, email, phone, GST..."
      exportFileName="suppliers"
      loadItems={loadItems}
      createItem={api.createSupplier}
      updateItem={api.updateSupplier}
      deleteItem={api.deleteSupplier}
    />
  );
}
