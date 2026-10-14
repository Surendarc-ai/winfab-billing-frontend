"use client";

import { useCallback } from "react";
import PartyMasterPage from "@/components/PartyMasterPage";
import { api } from "@/lib/api";

export default function CustomersPage() {
  const loadItems = useCallback(() => api.getCustomers(), []);

  return (
    <PartyMasterPage
      title="Customers"
      addLabel="Add Customer"
      searchPlaceholder="Search by name, email, phone, GST..."
      exportFileName="customers"
      loadItems={loadItems}
      createItem={api.createCustomer}
      updateItem={api.updateCustomer}
      deleteItem={api.deleteCustomer}
    />
  );
}
