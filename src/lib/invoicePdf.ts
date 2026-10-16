import { jsPDF } from "jspdf";
import { amountInWords } from "@/lib/amountInWords";
import type { Company, Party, PurchaseOrder, SalesInvoice } from "@/lib/api";

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Match sample amounts: 2100.00 (no thousand separators) */
function moneyPlain(value: number) {
  return Number(value || 0).toFixed(2);
}

function customerAddressLines(customer?: Party | null) {
  if (!customer) return [] as string[];
  const lines: string[] = [];
  if (customer.address) {
    lines.push(
      ...customer.address
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  const cityLine = [customer.city, customer.state].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

function companyAddressLines(company: Company | null) {
  if (!company?.address) return [] as string[];
  return company.address
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function poDateForItem(
  item: SalesInvoice["items"][number],
  purchases: PurchaseOrder[]
) {
  const byId = item.purchaseOrder
    ? purchases.find((p) => p._id === String(item.purchaseOrder))
    : undefined;
  if (byId?.poDate) return byId.poDate;
  if (item.poNumber) {
    const byNo = purchases.find((p) => p.poNumber === item.poNumber);
    if (byNo?.poDate) return byNo.poDate;
  }
  return "";
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Tax invoice layout matching WFE sample:
 * company header + logo → buyer | invoice meta box → items table →
 * totals → amount in words → bank | signature
 */
export function downloadSalesInvoicePdf({
  invoice,
  company,
  customer,
  purchases,
}: {
  invoice: SalesInvoice;
  company: Company | null;
  customer: Party | null;
  purchases: PurchaseOrder[];
}) {
  if (!customer) {
    throw new Error(
      "Select a customer on this invoice. HSN and GST % are taken from Customer master."
    );
  }
  const hsnCode = (customer.hsnCode || "").trim();
  const gstPct = Number(customer.gstPercentage);
  if (!hsnCode) {
    throw new Error(
      "HSN Code is missing on Customer master. Add it under Customers."
    );
  }
  if (!Number.isFinite(gstPct) || gstPct < 0) {
    throw new Error(
      "GST % is missing on Customer master. Add it under Customers."
    );
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 12;
  const right = pageW - 12;
  const top = 12;
  const bottom = pageH - 12;
  const width = right - left;

  const companyName = company?.name || "WINFAB ENGINEERING";
  const companyGstin = company?.gstin || "";
  const companyEmail = company?.email || "";
  const bankName = company?.bankName || "Union Bank Perungudi";
  const accountNo = company?.accountNo || "158613100000177";
  const ifscCode = company?.ifscCode || "UBIN0815861";
  const panNo = company?.panNo || "CVFPM7467R";
  const addrLines = companyAddressLines(company);

  const halfGst = gstPct / 2;
  const subtotal = Number(invoice.totalAmount || 0);
  const cgst = Number(((subtotal * halfGst) / 100).toFixed(2));
  const sgst = Number(((subtotal * halfGst) / 100).toFixed(2));
  const beforeRound = subtotal + cgst + sgst;
  const grandTotal = Math.round(beforeRound);
  const roundOff = Number((grandTotal - beforeRound).toFixed(2));

  // Column grid (mm) — proportions match sample table
  const col = {
    sr: left,
    hsn: left + 12,
    part: left + 34,
    qty: left + 128,
    rate: left + 142,
    amt: left + 162,
  };
  const rateRight = col.amt - 2;
  const amtRight = right - 2.5;
  const midX = left + width * 0.58;

  doc.setDrawColor(0);
  doc.setTextColor(0);

  // ========== HEADER: company left, logo right ==========
  let y = top + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(companyName.toUpperCase(), left, y);

  const logoW = 26;
  const logoH = 18;
  const logoX = right - logoW;
  if (company?.logo) {
    try {
      const fmt = company.logo.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(company.logo, fmt, logoX, top, logoW, logoH);
    } catch {
      // ignore bad logo
    }
  }

  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const line of addrLines) {
    doc.text(line, left, y);
    y += 3.5;
  }
  if (companyEmail) {
    doc.text(companyEmail, left, y);
    y += 3.5;
  }
  if (companyGstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${companyGstin}`, left, y);
    doc.setFont("helvetica", "normal");
    y += 3.5;
  }

  y = Math.max(y, top + (company?.logo ? 20 : 16)) + 3;

  // ========== Buyer | Invoice meta (full bordered box) ==========
  const metaH = 30;
  const sectionTop = y;
  const sectionBot = sectionTop + metaH;

  doc.setLineWidth(0.4);
  doc.rect(left, sectionTop, width, metaH);
  doc.line(midX, sectionTop, midX, sectionBot);

  // Meta internal grid: TAX INVOICE | Date / billNo | date / Order No | Order Date
  const metaMid = midX + (right - midX) / 2;
  const row1 = sectionTop + 8;
  const row2 = sectionTop + 16;
  doc.line(midX, row1, right, row1);
  doc.line(midX, row2, right, row2);
  doc.line(metaMid, sectionTop, metaMid, sectionBot);

  // Buyer (left)
  let by = sectionTop + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const buyerName = `M/s. ${(customer.name || "").toUpperCase()}`;
  const buyerNameWrapped = doc.splitTextToSize(buyerName, midX - left - 5);
  doc.text(buyerNameWrapped, left + 2.5, by);
  by += buyerNameWrapped.length * 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const line of customerAddressLines(customer)) {
    const wrapped = doc.splitTextToSize(line, midX - left - 5);
    doc.text(wrapped, left + 2.5, by);
    by += wrapped.length * 3.4;
    if (by > sectionBot - 6) break;
  }
  if (customer.gstNumber) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`GSTIN: ${customer.gstNumber}`, left + 2.5, sectionBot - 3);
  }

  // Invoice meta (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TAX INVOICE", midX + 2.5, sectionTop + 5.5);
  doc.text("Date", metaMid + 2.5, sectionTop + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.billNo || "", midX + 2.5, sectionTop + 13.5);
  doc.text(fmtDate(invoice.billDate), metaMid + 2.5, sectionTop + 13.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Order No", midX + 2.5, sectionTop + 22);
  doc.text("Order Date", metaMid + 2.5, sectionTop + 22);

  y = sectionBot;

  // ========== Items table ==========
  const headH = 7;
  const drawVCols = (y1: number, y2: number) => {
    doc.setLineWidth(0.35);
    doc.line(left, y1, left, y2);
    doc.line(col.hsn, y1, col.hsn, y2);
    doc.line(col.part, y1, col.part, y2);
    doc.line(col.qty, y1, col.qty, y2);
    doc.line(col.rate, y1, col.rate, y2);
    doc.line(col.amt, y1, col.amt, y2);
    doc.line(right, y1, right, y2);
  };

  const drawTableHeader = (atY: number) => {
    drawVCols(atY, atY + headH);
    doc.line(left, atY + headH, right, atY + headH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Sr.no", (col.sr + col.hsn) / 2, atY + 4.8, { align: "center" });
    doc.text("Hsn Code", (col.hsn + col.part) / 2, atY + 4.8, {
      align: "center",
    });
    doc.text("Particulars", col.part + 2, atY + 4.8);
    doc.text("Qty", (col.qty + col.rate) / 2, atY + 4.8, { align: "center" });
    doc.text("Rate", rateRight, atY + 4.8, { align: "right" });
    doc.text("Amount Rs", amtRight, atY + 4.8, { align: "right" });
  };

  // Totals + bank — always drawn in the footer zone of the last page
  const totalRowH = 5.8;
  const totalsH = 5 * totalRowH;
  const footerReserve = totalsH + 10 + 26;
  const footerTop = bottom - footerReserve;
  const partW = col.qty - col.part - 3;

  type PreparedRow = {
    textLines: string[];
    rowH: number;
    qty: number;
    rate: number;
    amount: number;
  };

  const prepared: PreparedRow[] = invoice.items.map((item) => {
    const poNo = item.poNumber || "";
    const poDate = fmtDate(poDateForItem(item, purchases));
    const poLine = poNo
      ? `PO No:${poNo}${poDate ? ` Date: ${poDate}` : ""}`
      : "";
    const partLine = `Part No: ${item.partNo} ${item.description}`.trim();
    const poWrapped = poLine ? doc.splitTextToSize(poLine, partW) : [];
    const partWrapped = doc.splitTextToSize(partLine, partW);
    const textLines = [...poWrapped, ...partWrapped];
    return {
      textLines,
      rowH: Math.max(10, textLines.length * 3.6 + 3.5),
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
    };
  });

  drawTableHeader(y);
  y += headH;

  let sr = 1;
  for (let i = 0; i < prepared.length; i++) {
    const row = prepared[i];
    // Height of this row + all rows still to print
    let restH = 0;
    for (let j = i; j < prepared.length; j++) restH += prepared[j].rowH;
    // If remaining rows + footer fit here → keep footer free (~9 items).
    // Otherwise fill the page; totals go to next page footer.
    const remainingFitWithFooter = y + restH <= footerTop;
    const pageLimit = remainingFitWithFooter ? footerTop : bottom - 2;

    if (y + row.rowH > pageLimit) {
      doc.addPage();
      y = top + 4;
      drawTableHeader(y);
      y += headH;
    }

    const rowTop = y;
    drawVCols(rowTop, rowTop + row.rowH);
    doc.setLineWidth(0.3);
    doc.line(left, rowTop + row.rowH, right, rowTop + row.rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(sr++), (col.sr + col.hsn) / 2, rowTop + 4.5, {
      align: "center",
    });
    doc.text(hsnCode, (col.hsn + col.part) / 2, rowTop + 4.5, {
      align: "center",
    });
    doc.text(row.textLines, col.part + 1.5, rowTop + 4);
    doc.text(String(row.qty), (col.qty + col.rate) / 2, rowTop + 4.5, {
      align: "center",
    });
    doc.text(moneyPlain(row.rate), rateRight, rowTop + 4.5, {
      align: "right",
    });
    doc.text(moneyPlain(row.amount), amtRight, rowTop + 4.5, {
      align: "right",
    });
    y += row.rowH;
  }

  // Items closed. No room for footer on this page → next page, totals in footer.
  const totals: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: "TOTAL INVOICE", value: moneyPlain(subtotal), bold: true },
    { label: `CGST-${halfGst}%`, value: moneyPlain(cgst) },
    { label: `SGST-${halfGst}%`, value: moneyPlain(sgst) },
    { label: "Round off", value: moneyPlain(roundOff) },
    {
      label: "TOTAL INVOICE VALUE",
      value: moneyPlain(grandTotal),
      bold: true,
    },
  ];

  if (y > footerTop) {
    doc.addPage();
  }

  const totalsTop = footerTop;

  doc.setLineWidth(0.35);
  doc.line(left, totalsTop, left, totalsTop + totalsH);
  doc.line(right, totalsTop, right, totalsTop + totalsH);
  doc.line(col.amt, totalsTop, col.amt, totalsTop + totalsH);

  for (let i = 0; i < totals.length; i++) {
    const rowTop = totalsTop + i * totalRowH;
    doc.line(left, rowTop + totalRowH, right, rowTop + totalRowH);
    if (i === 0) doc.line(left, rowTop, right, rowTop);
    const t = totals[i];
    doc.setFont("helvetica", t.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(t.label, col.amt - 3, rowTop + 4.1, { align: "right" });
    doc.text(t.value, amtRight, rowTop + 4.1, { align: "right" });
  }

  // Amount in words
  let fy = totalsTop + totalsH + 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text(`(Rupees: ${amountInWords(grandTotal)})`, left, fy);

  // Bank left | Signature right
  fy += 8;
  const footTop = fy;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bank Details:", left, fy);
  fy += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Bank Name:${bankName}`, left, fy);
  fy += 4.2;
  doc.text(`Account No:${accountNo}`, left, fy);
  fy += 4.2;
  doc.text(`IFSC Code : ${ifscCode}`, left, fy);
  fy += 4.2;
  doc.text(`Our PAN No: ${panNo}`, left, fy);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`for ${toTitleCase(companyName)}`, right, footTop + 10, {
    align: "right",
  });

  const fileName = `${invoice.billNo || "invoice"}.pdf`.replace(
    /[^\w.-]+/g,
    "_"
  );
  doc.save(fileName);
}
