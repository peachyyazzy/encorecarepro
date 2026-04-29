import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { billing } from "@encorecare/shared";

/**
 * Claim-ready superbill PDF. Designed so a private-pay rider can hand this
 * (or upload it) to their payer / HSA / FSA / waiver-program coordinator
 * and have everything an 1500 / 837P submission needs:
 *   - Provider info: legal name, address, phone, NPI, tax ID
 *   - Patient info: name, DOB, member ID, payer name
 *   - Service lines: HCPCS code + origin/destination modifier, dates,
 *     units (mileage), unit price, line total
 *   - Totals + payment status
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#1158c7" },
  brandSub: { fontSize: 9, color: "#475569", marginTop: 4 },
  invoiceMetaBox: { textAlign: "right" },
  invoiceTitle: { fontSize: 22, fontWeight: 700 },
  metaRow: { fontSize: 9, color: "#475569", marginTop: 4 },
  metaValue: { color: "#0f172a", fontWeight: 600 },
  parties: { flexDirection: "row", gap: 24, marginBottom: 24 },
  partyBlock: { flex: 1 },
  partyLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 4,
  },
  partyLine: { fontSize: 10, marginBottom: 1 },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, marginBottom: 16 },
  thead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  th: { fontSize: 8, fontWeight: 700, color: "#475569", textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  trLast: { borderBottomWidth: 0 },
  td: { fontSize: 10 },
  colDate: { width: 70 },
  colDesc: { flex: 1, paddingRight: 8 },
  colCode: { width: 60 },
  colMod: { width: 50 },
  colQty: { width: 40, textAlign: "right" },
  colPrice: { width: 60, textAlign: "right" },
  colTotal: { width: 60, textAlign: "right" },
  totalsBox: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 24 },
  totalsTable: { width: 220, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 10, color: "#475569" },
  totalsValue: { fontSize: 10, fontWeight: 600 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
  },
  grandLabel: { fontSize: 12, fontWeight: 700 },
  grandValue: { fontSize: 12, fontWeight: 700 },
  paidBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  dueBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  notes: { fontSize: 9, color: "#475569", marginTop: 16, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

interface Props {
  invoice: billing.Invoice;
  paid: boolean;
  payerName?: string | null;
}

export function InvoiceDocument({ invoice, paid, payerName }: Props) {
  const provider = invoice.provider;
  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={provider.legalName}
      subject="NEMT services superbill"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{provider.doingBusinessAs ?? provider.legalName}</Text>
            <Text style={styles.brandSub}>
              {provider.addressLine1}
            </Text>
            <Text style={styles.brandSub}>
              {provider.city}, {provider.state} {provider.postalCode}
            </Text>
            <Text style={styles.brandSub}>
              {provider.phone} · {provider.email}
            </Text>
            {provider.taxId && <Text style={styles.brandSub}>Tax ID: {provider.taxId}</Text>}
            {provider.npi && <Text style={styles.brandSub}>NPI: {provider.npi}</Text>}
          </View>
          <View style={styles.invoiceMetaBox}>
            <Text style={paid ? styles.paidBadge : styles.dueBadge}>
              {paid ? "PAID" : "DUE"}
            </Text>
            <Text style={styles.invoiceTitle}>Superbill</Text>
            <Text style={styles.metaRow}>
              Invoice <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </Text>
            <Text style={styles.metaRow}>
              Issued <Text style={styles.metaValue}>{invoice.issuedAt.toLocaleDateString()}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Patient</Text>
            <Text style={styles.partyLine}>
              {invoice.patient.firstName} {invoice.patient.lastName}
            </Text>
            <Text style={styles.partyLine}>DOB {invoice.patient.dateOfBirth}</Text>
            {invoice.patient.memberId && (
              <Text style={styles.partyLine}>Member ID {invoice.patient.memberId}</Text>
            )}
            {(invoice.patient.payerName ?? payerName) && (
              <Text style={styles.partyLine}>
                Payer: {invoice.patient.payerName ?? payerName}
              </Text>
            )}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.partyLine}>{invoice.billedTo.name}</Text>
            {invoice.billedTo.addressLine1 && (
              <Text style={styles.partyLine}>{invoice.billedTo.addressLine1}</Text>
            )}
            {(invoice.billedTo.city || invoice.billedTo.state) && (
              <Text style={styles.partyLine}>
                {invoice.billedTo.city}
                {invoice.billedTo.state ? `, ${invoice.billedTo.state}` : ""}
                {invoice.billedTo.postalCode ? ` ${invoice.billedTo.postalCode}` : ""}
              </Text>
            )}
            {invoice.billedTo.email && <Text style={styles.partyLine}>{invoice.billedTo.email}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colCode]}>HCPCS</Text>
            <Text style={[styles.th, styles.colMod]}>Modifier</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Price</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {invoice.lines.map((line, i) => {
            const last = i === invoice.lines.length - 1;
            return (
              <View key={i} style={[styles.tr, last && styles.trLast]} wrap={false}>
                <Text style={[styles.td, styles.colDate]}>{line.serviceDate}</Text>
                <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
                <Text style={[styles.td, styles.colCode]}>{line.hcpcsCode}</Text>
                <Text style={[styles.td, styles.colMod]}>{line.modifiers.join(" ")}</Text>
                <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
                <Text style={[styles.td, styles.colPrice]}>
                  {money(line.unitPriceCents)}
                </Text>
                <Text style={[styles.td, styles.colTotal]}>{money(line.totalCents)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(invoice.subtotalCents)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandLabel}>{paid ? "Total paid" : "Total due"}</Text>
              <Text style={styles.grandValue}>{money(invoice.totalCents)}</Text>
            </View>
          </View>
        </View>

        {invoice.notes && <Text style={styles.notes}>{invoice.notes}</Text>}

        <Text style={styles.notes}>
          This document is a claim-ready superbill. Submit it to your insurance
          payer, Medicaid waiver coordinator, HSA, or FSA administrator for
          reimbursement. Procedure codes (HCPCS) and origin/destination
          modifiers are included exactly as required for an 837P / CMS-1500
          claim.
        </Text>

        <Text style={styles.footer} fixed>
          {provider.legalName} · {provider.email} · Generated{" "}
          {new Date().toISOString().slice(0, 10)}
        </Text>
      </Page>
    </Document>
  );
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
