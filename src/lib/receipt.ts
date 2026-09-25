import type { ReportRow, UpdateRow } from "./reports";

const esc = (s: unknown) =>
  String(s ?? "—").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Opens a printable receipt (Save as PDF from the print dialog). No auth data included. */
export function downloadReceipt(args: {
  report: ReportRow & { source?: string };
  department: string | null;
  timeline: UpdateRow[];
  feedback: { rating: number | null; comment: string | null } | null;
}) {
  const { report: r, department, timeline, feedback } = args;
  const location = [r.village_or_ward, r.block, r.municipality, r.district].filter(Boolean).join(", ");
  const rows = timeline
    .map(
      (t) =>
        `<tr><td>${esc(new Date(t.created_at).toLocaleString())}</td><td>${esc(t.new_status?.replace(/_/g, " "))}</td><td>${esc(t.remark)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(r.public_issue_id)}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0}header{border-bottom:3px solid #1e3a6e;padding-bottom:8px;margin-bottom:16px}
dl{display:grid;grid-template-columns:200px 1fr;gap:6px 12px}dt{font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:14px}
.note{font-size:12px;color:#555;margin-top:24px}@media print{button{display:none}}</style></head><body>
<header><h1>Jan Samadhan Jharkhand — Report Receipt</h1><p>Report ID: <strong>${esc(r.public_issue_id)}</strong></p></header>
<dl><dt>Title</dt><dd>${esc(r.title)}</dd><dt>Category</dt><dd>${esc(r.ai_category ?? r.category_key)}</dd>
<dt>Location</dt><dd>${esc(location)}</dd><dt>Created</dt><dd>${esc(new Date(r.created_at).toLocaleString())}</dd>
<dt>Source</dt><dd>${esc(r.source ?? "Web Form")}</dd>
<dt>AI recommendation</dt><dd>${esc(r.ai_recommended_department)} (priority: ${esc(r.ai_priority)}) — suggestion only, reviewed by officers</dd>
<dt>Assigned department</dt><dd>${esc(department ?? "Not yet assigned")}</dd>
<dt>Current status</dt><dd>${esc(r.status.replace(/_/g, " "))}</dd>
${feedback ? `<dt>Citizen feedback</dt><dd>${esc(feedback.rating)}/5 — ${esc(feedback.comment)}</dd>` : ""}</dl>
<h2 style="font-size:18px;margin-top:20px">Status timeline</h2>
<table><thead><tr><th>Date</th><th>Status</th><th>Remark</th></tr></thead><tbody>${rows || "<tr><td colspan=3>No updates yet</td></tr>"}</tbody></table>
<p class="note">Generated ${esc(new Date().toLocaleString())}. Prototype receipt for the Government of Jharkhand.</p>
<button onclick="window.print()">Print / Save as PDF</button>
<script>window.onload=()=>window.print()</script></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${r.public_issue_id}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
