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

/** Match sample amounts: 104274.00 (no thousand separators) */
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
  const left = 10;
  const right = pageW - 10;
  const top = 10;
  const bottom = pageH - 10;
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

  // Column grid for items table
  const col = {
    sr: left,
    hsn: left + 14,
    part: left + 36,
    qty: left + 122,
    rate: left + 138,
    amt: left + 160,
  };
  const rateRight = col.amt - 1.5;
  const amtRight = right - 2;
  const midX = left + width * 0.55;

  let y = top + 6;

  // ========== HEADER: Company + GSTIN left, logo alone right ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(companyName.toUpperCase(), left + 3, y);

  // Logo alone on the right
  const logoW = 22;
  const logoH = 16;
  const logoX = right - logoW - 3;
  if (company?.logo) {
    try {
      const fmt = company.logo.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(company.logo, fmt, logoX, top + 3, logoW, logoH);
    } catch {
      // ignore bad logo
    }
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const line of addrLines) {
    doc.text(line, left + 3, y);
    y += 3.6;
  }
  if (companyEmail) {
    doc.text(companyEmail, left + 3, y);
    y += 3.6;
  }
  if (companyGstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${companyGstin}`, left + 3, y);
    doc.setFont("helvetica", "normal");
    y += 3.6;
  }

  y = Math.max(y, top + (company?.logo ? 22 : 18)) + 2;

  // Divider under company header
  doc.setLineWidth(0.35);
  doc.line(left, y, right, y);

  // ========== Buyer left | Invoice meta right ==========
  const sectionTop = y;
  const metaH = 28;
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  // outer left & right borders for this header block
  doc.line(left, sectionTop, left, sectionTop + metaH);
  doc.line(right, sectionTop, right, sectionTop + metaH);
  doc.line(midX, sectionTop, midX, sectionTop + metaH);
  doc.line(left, sectionTop + metaH, right, sectionTop + metaH);

  // Buyer
  let by = sectionTop + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const buyerName = `M/s. ${(customer.name || "").toUpperCase()}`;
  doc.text(buyerName, left + 3, by);
  by += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const line of customerAddressLines(customer)) {
    const wrapped = doc.splitTextToSize(line, midX - left - 6);
    doc.text(wrapped, left + 3, by);
    by += wrapped.length * 3.5;
  }
  if (customer.gstNumber) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${customer.gstNumber}`, left + 3, sectionTop + metaH - 3);
  }

  // Right meta: TAX INVOICE | Date  /  billNo | dateValue
  //              Order No   | Order Date
  const metaLeft = midX;
  const metaMid = midX + (right - midX) / 2;

  doc.line(metaMid, sectionTop, metaMid, sectionTop + 16);
  doc.line(metaLeft, sectionTop + 8, right, sectionTop + 8);
  doc.line(metaLeft, sectionTop + 16, right, sectionTop + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TAX INVOICE", metaLeft + 3, sectionTop + 5.5);
  doc.text("Date", metaMid + 3, sectionTop + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.billNo, metaLeft + 3, sectionTop + 13.5);
  doc.text(fmtDate(invoice.billDate), metaMid + 3, sectionTop + 13.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Order No", metaLeft + 3, sectionTop + 20.5);
  doc.text("Order Date", metaMid + 3, sectionTop + 20.5);

  y = sectionTop + metaH;

  // ========== Items table header ==========
  const headH = 7;
  doc.setLineWidth(0.3);
  // vertical column lines (incl. left & right outer edges)
  const drawCols = (y1: number, y2: number) => {
    doc.line(left, y1, left, y2);
    doc.line(col.hsn, y1, col.hsn, y2);
    doc.line(col.part, y1, col.part, y2);
    doc.line(col.qty, y1, col.qty, y2);
    doc.line(col.rate, y1, col.rate, y2);
    doc.line(col.amt, y1, col.amt, y2);
    doc.line(right, y1, right, y2);
  };

  doc.setFillColor(255, 255, 255);
  doc.rect(left, y, width, headH);
  drawCols(y, y + headH);
  doc.line(left, y + headH, right, y + headH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Sr.no", col.sr + 7, y + 4.8, { align: "center" });
  doc.text("Hsn Code", col.hsn + 11, y + 4.8, { align: "center" });
  doc.text("Particulars", col.part + 2, y + 4.8);
  doc.text("Qty", col.qty + 8, y + 4.8, { align: "center" });
  doc.text("Rate", rateRight, y + 4.8, { align: "right" });
  doc.text("Amount Rs", amtRight, y + 4.8, { align: "right" });
  y += headH;

  // ========== Line items: PO + Part inside Particulars (sample style) ==========
  let sr = 1;
  for (const item of invoice.items) {
    const poNo = item.poNumber || "";
    const poDate = fmtDate(poDateForItem(item, purchases));
    const poLine = poNo
      ? `PO No:${poNo}${poDate ? ` Date: ${poDate}` : ""}`
      : "";
    const partLine = `Part No: ${item.partNo} ${item.description}`.trim();

    const poWrapped = poLine
      ? doc.splitTextToSize(poLine, col.qty - col.part - 3)
      : [];
    const partWrapped = doc.splitTextToSize(partLine, col.qty - col.part - 3);
    const textLines = [...poWrapped, ...partWrapped];
    const rowH = Math.max(9, textLines.length * 3.5 + 3);

    if (y + rowH > bottom - 55) {
      doc.addPage();
      y = top + 4;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(left, y + headH, right, y + headH);
      drawCols(y, y + headH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Sr.no", col.sr + 7, y + 4.8, { align: "center" });
      doc.text("Hsn Code", col.hsn + 11, y + 4.8, { align: "center" });
      doc.text("Particulars", col.part + 2, y + 4.8);
      doc.text("Qty", col.qty + 8, y + 4.8, { align: "center" });
      doc.text("Rate", rateRight, y + 4.8, { align: "right" });
      doc.text("Amount Rs", amtRight, y + 4.8, { align: "right" });
      y += headH;
    }

    const rowTop = y;
    drawCols(rowTop, rowTop + rowH);
    doc.setLineWidth(0.25);
    doc.line(left, rowTop + rowH, right, rowTop + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(sr++), col.sr + 7, rowTop + 4.5, { align: "center" });
    doc.text(hsnCode, col.hsn + 11, rowTop + 4.5, { align: "center" });
    doc.text(textLines, col.part + 1.5, rowTop + 4);
    doc.text(String(item.qty), col.qty + 8, rowTop + 4.5, { align: "center" });
    doc.text(moneyPlain(item.rate), rateRight, rowTop + 4.5, {
      align: "right",
    });
    doc.text(moneyPlain(item.amount), amtRight, rowTop + 4.5, {
      align: "right",
    });
    y += rowH;
  }

  // ========== Totals — label | vertical line | amount ==========
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

  const totalRowH = 5.5;
  const totalsTop = y;
  const totalsH = totals.length * totalRowH;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  // left/right outer + divider between label and amount
  doc.line(left, totalsTop, left, totalsTop + totalsH);
  doc.line(right, totalsTop, right, totalsTop + totalsH);
  doc.line(col.amt, totalsTop, col.amt, totalsTop + totalsH);

  for (let i = 0; i < totals.length; i++) {
    const rowTop = totalsTop + i * totalRowH;
    doc.line(left, rowTop + totalRowH, right, rowTop + totalRowH);
    const t = totals[i];
    doc.setFont("helvetica", t.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(t.label, col.qty + 1.5, rowTop + 4);
    doc.text(t.value, amtRight, rowTop + 4, { align: "right" });
  }
  y = totalsTop + totalsH;

  // ========== Amount in words ==========
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(`(Rupees: ${amountInWords(grandTotal)})`, left + 3, y);

  // ========== Bank left | Signature right ==========
  y += 7;
  const footTop = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bank Details:", left + 3, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Bank Name:${bankName}`, left + 3, y);
  y += 4;
  doc.text(`Account No:${accountNo}`, left + 3, y);
  y += 4;
  doc.text(`IFSC Code : ${ifscCode}`, left + 3, y);
  y += 4;
  doc.text(`Our PAN No: ${panNo}`, left + 3, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`for ${toTitleCase(companyName)}`, right - 3, footTop + 8, {
    align: "right",
  });

  const fileName = `${invoice.billNo || "invoice"}.pdf`.replace(
    /[^\w.-]+/g,
    "_"
  );
  doc.save(fileName);
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
