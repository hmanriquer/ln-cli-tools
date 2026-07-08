import path from "node:path";
import pc from "picocolors";
import { summarize } from "../core/report.js";
import { buildFixPrompt } from "../core/fixPrompt.js";
import type { Finding, HealthReport, Severity } from "../core/types.js";
import { openInBrowser, writeReport } from "../infra/reportOutput.js";
import { APP_NAME, AUTHOR } from "./brand.js";

const SEV: Record<Severity, { icon: string; label: string }> = {
  error: { icon: "✖", label: "err" },
  warning: { icon: "⚠", label: "warn" },
  info: { icon: "•", label: "info" },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function projectName(root: string, scanRoot?: string): string {
  if (scanRoot) {
    const rel = path.relative(scanRoot, root);
    if (rel && !rel.startsWith("..")) return rel.split(path.sep).join("/");
  }
  return path.basename(root) || root;
}

function chip(cls: Severity | "ok", n: number, label: string): string {
  const zero = n === 0 ? " zero" : "";
  return `<span class="chip ${cls}${zero}">${n} ${label}</span>`;
}

function countChips(counts: Record<Severity, number>): string {
  return chip("error", counts.error, "err") + chip("warning", counts.warning, "warn") + chip("info", counts.info, "info");
}

function bar(counts: Record<Severity, number>): string {
  const total = counts.error + counts.warning + counts.info;
  if (total === 0) return '<div class="bar"><span class="seg ok" style="width:100%"></span></div>';
  const pct = (n: number) => `${((n / total) * 100).toFixed(2)}%`;
  return (
    '<div class="bar">' +
    `<span class="seg error" style="width:${pct(counts.error)}"></span>` +
    `<span class="seg warning" style="width:${pct(counts.warning)}"></span>` +
    `<span class="seg info" style="width:${pct(counts.info)}"></span>` +
    "</div>"
  );
}

function renderFinding(f: Finding): string {
  const sev = SEV[f.severity];
  const tag = f.source === "ai" ? "AI" : "probe";
  const search = escapeHtml(
    [f.title, f.detail, f.file, f.recommendation].filter(Boolean).join(" ").toLowerCase(),
  );
  const lines = [
    `<div class="finding f-${f.severity}" data-sev="${f.severity}" data-search="${search}">`,
    `<div class="f-head"><span class="f-icon ${f.severity}">${sev.icon}</span>` +
      `<span class="f-title">${escapeHtml(f.title)}</span><span class="f-tag">${tag}</span></div>`,
  ];
  if (f.file) lines.push(`<div class="f-file">${escapeHtml(f.file)}</div>`);
  if (f.detail) lines.push(`<div class="f-detail">${escapeHtml(f.detail)}</div>`);
  if (f.recommendation) lines.push(`<div class="f-rec">→ ${escapeHtml(f.recommendation)}</div>`);
  lines.push("</div>");
  return lines.join("");
}

function renderProject(report: HealthReport, scanRoot?: string): string {
  const counts = summarize(report.findings);
  const name = projectName(report.root, scanRoot);
  const badges = report.stacks.map((s) => `<span class="badge">${escapeHtml(s)}</span>`).join("");
  const ai = report.ai?.narrative
    ? `<div class="ai"><div class="ai-h">AI summary</div><div class="ai-body">${escapeHtml(report.ai.narrative)}</div></div>`
    : report.ai?.skipped
      ? `<div class="ai skipped">AI analysis skipped: ${escapeHtml(report.ai.skipped)}</div>`
      : "";
  const findings = report.findings.length
    ? report.findings.map(renderFinding).join("")
    : '<div class="clean">No findings 🎉</div>';

  const fixPrompt = buildFixPrompt(report, name);
  const fixBlock = fixPrompt
    ? '<div class="fixprompt">' +
      '<div class="fp-head"><span>🛠 Prompt to fix these with Claude</span>' +
      '<button class="copy-btn" type="button">Copy</button></div>' +
      `<textarea class="fp-text" readonly rows="12" spellcheck="false">${escapeHtml(fixPrompt)}</textarea>` +
      "</div>"
    : "";

  return (
    '<details class="project" open>' +
    `<summary><span class="p-name">${escapeHtml(name)}</span>${badges}` +
    `<span class="p-chips">${countChips(counts)}</span></summary>` +
    '<div class="p-body">' +
    `<div class="path">${escapeHtml(report.root)}</div>` +
    bar(counts) +
    ai +
    `<div class="findings">${findings}</div>` +
    '<div class="filtered-note">No findings match the current filter.</div>' +
    fixBlock +
    "</div>" +
    "</details>"
  );
}

const STYLE = `
:root{--bg:#f6f7f9;--panel:#fff;--fg:#1c2024;--muted:#6b7280;--border:#e4e6eb;
--error:#d1383d;--warning:#b7791f;--info:#1a76d2;--ok:#178a5a}
@media(prefers-color-scheme:dark){:root{--bg:#0f1216;--panel:#161a20;--fg:#e6e8eb;--muted:#9aa4b2;--border:#262b33;
--error:#ff6169;--warning:#e2b23a;--info:#5ab0ff;--ok:#3ecf8e}}
*{box-sizing:border-box}
body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg)}
header.top{position:sticky;top:0;z-index:5;background:var(--panel);border-bottom:1px solid var(--border);padding:14px 20px}
.brand{font-size:18px;font-weight:700}.brand .author{font-weight:400;color:var(--muted);font-size:13px;margin-left:6px}
.meta{color:var(--muted);font-size:12px;margin-top:2px}.totals{margin-top:8px}
.toolbar{position:sticky;top:74px;z-index:4;display:flex;gap:12px;align-items:center;flex-wrap:wrap;
background:var(--bg);border-bottom:1px solid var(--border);padding:10px 20px}
.toolbar label{color:var(--fg);font-size:13px;cursor:pointer}.toolbar .spacer{flex:1}
.toolbar input[type=search]{padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--fg);min-width:200px}
.toolbar button{padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--fg);cursor:pointer}
main{padding:16px 20px;max-width:1000px;margin:0 auto}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;margin-right:6px;color:#fff}
.chip.error{background:var(--error)}.chip.warning{background:var(--warning)}.chip.info{background:var(--info)}
.chip.ok{background:var(--ok)}.chip.zero{opacity:.28}
.project{background:var(--panel);border:1px solid var(--border);border-radius:10px;margin:12px 0;overflow:hidden}
.project>summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.project>summary::-webkit-details-marker{display:none}
.p-name{font-weight:700}.p-chips{margin-left:auto}
.badge{font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:1px 6px}
.p-body{padding:0 14px 14px}
.path{color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;margin-bottom:8px}
.bar{display:flex;height:6px;border-radius:4px;overflow:hidden;background:var(--border);margin-bottom:12px}
.seg{display:block;height:100%}.seg.error{background:var(--error)}.seg.warning{background:var(--warning)}.seg.info{background:var(--info)}.seg.ok{background:var(--ok)}
.ai{border-left:3px solid var(--info);background:color-mix(in srgb,var(--info) 8%,transparent);padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:12px}
.ai-h{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:4px}
.ai.skipped{color:var(--muted);border-left-color:var(--muted);background:transparent}
.finding{border-top:1px solid var(--border);padding:10px 0}
.f-head{display:flex;align-items:center;gap:8px}
.f-icon.error{color:var(--error)}.f-icon.warning{color:var(--warning)}.f-icon.info{color:var(--info)}
.f-title{font-weight:600}.f-tag{margin-left:auto;font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:0 6px}
.f-file{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--muted);margin-top:2px}
.f-detail{margin-top:4px}.f-rec{margin-top:4px;color:var(--ok)}
.clean{color:var(--ok);padding:8px 0}
.filtered-note{display:none;color:var(--muted);padding:8px 0}
.project.filtered-empty .findings{display:none}.project.filtered-empty .filtered-note{display:block}
.fixprompt{margin-top:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.fp-head{display:flex;align-items:center;justify-content:space-between;background:var(--bg);padding:7px 10px;font-size:12px;font-weight:600;color:var(--fg)}
.copy-btn{cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--fg);border-radius:6px;padding:3px 12px;font-size:12px}
.copy-btn:hover{border-color:var(--info)}
.fp-text{display:block;width:100%;border:0;border-top:1px solid var(--border);background:var(--panel);color:var(--fg);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:10px;resize:vertical}
`;

const SCRIPT = [
  "(function(){",
  "  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[data-sev]'));",
  "  var search = document.getElementById('search');",
  "  function apply(){",
  "    var active = {};",
  "    boxes.forEach(function(b){ active[b.getAttribute('data-sev')] = b.checked; });",
  "    var q = (search && search.value ? search.value : '').toLowerCase().trim();",
  "    var findings = document.querySelectorAll('.finding');",
  "    for (var i=0;i<findings.length;i++){",
  "      var el = findings[i];",
  "      var sev = el.getAttribute('data-sev');",
  "      var text = el.getAttribute('data-search') || '';",
  "      var vis = active[sev] && (q === '' || text.indexOf(q) !== -1);",
  "      el.style.display = vis ? '' : 'none';",
  "    }",
  "    var projects = document.querySelectorAll('.project');",
  "    for (var j=0;j<projects.length;j++){",
  "      var fs = projects[j].querySelectorAll('.finding');",
  "      var any=false;",
  "      for (var k=0;k<fs.length;k++){ if (fs[k].style.display !== 'none'){ any=true; break; } }",
  "      projects[j].classList.toggle('filtered-empty', fs.length>0 && !any);",
  "    }",
  "  }",
  "  boxes.forEach(function(b){ b.addEventListener('change', apply); });",
  "  if (search) search.addEventListener('input', apply);",
  "  function setAll(open){ var d=document.querySelectorAll('details.project'); for(var i=0;i<d.length;i++){ d[i].open=open; } }",
  "  var ea=document.getElementById('expandAll'); if(ea) ea.addEventListener('click', function(){ setAll(true); });",
  "  var ca=document.getElementById('collapseAll'); if(ca) ca.addEventListener('click', function(){ setAll(false); });",
  "  var copyBtns = document.querySelectorAll('.copy-btn');",
  "  for (var m=0;m<copyBtns.length;m++){",
  "    (function(btn){",
  "      btn.addEventListener('click', function(){",
  "        var box = btn.closest('.fixprompt'); var ta = box ? box.querySelector('.fp-text') : null;",
  "        if (!ta) return;",
  "        var label = btn.textContent;",
  "        var done = function(){ btn.textContent='Copied!'; setTimeout(function(){ btn.textContent=label; }, 1200); };",
  "        var fallback = function(){ ta.focus(); ta.select(); try { document.execCommand('copy'); } catch(e){} done(); };",
  "        if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(done, fallback); }",
  "        else { fallback(); }",
  "      });",
  "    })(copyBtns[m]);",
  "  }",
  "})();",
].join("\n");

export interface BuildHtmlOptions {
  scanRoot?: string;
}

/** Build a single self-contained HTML report for one or many project reports. */
export function buildHtml(reports: HealthReport[], opts: BuildHtmlOptions = {}): string {
  const generatedAt = new Date().toISOString();
  const totals = reports.reduce(
    (acc, r) => {
      const c = summarize(r.findings);
      acc.error += c.error;
      acc.warning += c.warning;
      acc.info += c.info;
      return acc;
    },
    { error: 0, warning: 0, info: 0 } as Record<Severity, number>,
  );
  const projectCount = reports.length;
  const body = reports.map((r) => renderProject(r, opts.scanRoot)).join("\n");

  const toolbar =
    '<div class="toolbar">' +
    '<label><input type="checkbox" data-sev="error" checked> Errors</label>' +
    '<label><input type="checkbox" data-sev="warning" checked> Warnings</label>' +
    '<label><input type="checkbox" data-sev="info" checked> Info</label>' +
    '<input id="search" type="search" placeholder="Filter findings…">' +
    '<span class="spacer"></span>' +
    '<button id="expandAll">Expand all</button>' +
    '<button id="collapseAll">Collapse all</button>' +
    "</div>";

  return (
    "<!doctype html>\n" +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escapeHtml(APP_NAME)} report</title><style>${STYLE}</style></head><body>` +
    '<header class="top">' +
    `<div class="brand">${escapeHtml(APP_NAME)}<span class="author">${escapeHtml(AUTHOR)}</span></div>` +
    `<div class="meta">${projectCount} project${projectCount === 1 ? "" : "s"} · generated ${escapeHtml(generatedAt)}</div>` +
    `<div class="totals">${countChips(totals)}</div>` +
    "</header>" +
    toolbar +
    `<main>${body}</main>` +
    `<script>${SCRIPT}</script>` +
    "</body></html>"
  );
}

export interface EmitOptions {
  outPath: string;
  open: boolean;
  scanRoot?: string;
}

/** Build the HTML, write it to disk, print the path, and (optionally) open it. */
export function emitHtmlReport(reports: HealthReport[], opts: EmitOptions): void {
  const html = buildHtml(reports, { scanRoot: opts.scanRoot });
  const abs = writeReport(html, opts.outPath);
  console.error(pc.dim(`  report written: ${abs}`));
  if (opts.open) openInBrowser(abs);
}
