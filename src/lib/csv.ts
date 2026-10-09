export type HistoryCsvRow =
  | {
      kind: "earning";
      id: string;
      createdAt: number;
      source: string;
      amount: number;
      referenceId?: string;
      txId?: string;
      note?: string;
    }
  | {
      kind: "withdrawal";
      id: string;
      createdAt: number;
      status: string;
      amount: number;
      fee: number;
      netAmount: number;
      rejectReason?: string;
      referenceId?: string;
    };

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDate(ms: number): string {
  try {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  } catch {
    return String(ms);
  }
}

const CSV_HEADER = [
  "Date",
  "Type",
  "Source/Status",
  "Amount (APN or NGN)",
  "Reference ID",
  "Note",
];

export function generateCsv(rows: HistoryCsvRow[]): string {
  const lines: string[] = [CSV_HEADER.map(csvEscape).join(",")];
  for (const r of rows) {
    if (r.kind === "earning") {
      const noteParts: string[] = [];
      if (r.note) noteParts.push(r.note);
      lines.push(
        [
          csvEscape(formatDate(r.createdAt)),
          csvEscape("Earning"),
          csvEscape(r.source),
          csvEscape(Number.isFinite(r.amount) ? r.amount.toFixed(2) : String(r.amount)),
          csvEscape(r.referenceId ?? r.txId ?? r.id),
          csvEscape(noteParts.join("; ")),
        ].join(","),
      );
    } else {
      const noteParts: string[] = [];
      noteParts.push(`Fee: ${Number.isFinite(r.fee) ? r.fee.toFixed(2) : r.fee}`);
      noteParts.push(`Net: ${Number.isFinite(r.netAmount) ? r.netAmount.toFixed(2) : r.netAmount}`);
      if (r.rejectReason) noteParts.push(`Rejected: ${r.rejectReason}`);
      lines.push(
        [
          csvEscape(formatDate(r.createdAt)),
          csvEscape("Withdrawal"),
          csvEscape(r.status),
          csvEscape(Number.isFinite(r.amount) ? r.amount.toFixed(2) : String(r.amount)),
          csvEscape(r.referenceId ?? r.id),
          csvEscape(noteParts.join("; ")),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function csvToDataUrl(csvText: string): string {
  const bom = "\uFEFF";
  const encoded = encodeURIComponent(bom + csvText);
  return `data:text/csv;charset=utf-8,${encoded}`;
}
