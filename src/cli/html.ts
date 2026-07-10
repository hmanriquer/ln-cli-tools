import path from "node:path";
import pc from "picocolors";
import { summarize } from "../core/report.js";
import { buildFixPrompt } from "../core/fixPrompt.js";
import { cleanNarrative } from "../core/narrative.js";
import type { Finding, HealthReport, Severity } from "../core/types.js";
import { openInBrowser, writeReport } from "../infra/reportOutput.js";
import { APP_NAME, AUTHOR } from "./brand.js";

const SEV: Record<Severity, { label: string; full: string }> = {
  error: { label: "err", full: "Error" },
  warning: { label: "warn", full: "Warning" },
  info: { label: "info", full: "Info" },
};

const SEV_ORDER: Severity[] = ["error", "warning", "info"];

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

/** Friendly UTC timestamp, e.g. "Jul 9, 2026 · 22:47 UTC". */
function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date} · ${time} UTC`;
}

function chip(cls: Severity | "ok", n: number, label: string): string {
  const zero = n === 0 ? " zero" : "";
  return `<span class="chip ${cls}${zero}">${n} ${label}</span>`;
}

function countChips(counts: Record<Severity, number>): string {
  return (
    chip("error", counts.error, "err") +
    chip("warning", counts.warning, "warn") +
    chip("info", counts.info, "info")
  );
}

function bar(counts: Record<Severity, number>): string {
  const total = counts.error + counts.warning + counts.info;
  if (total === 0)
    return '<div class="bar"><span class="seg ok" style="width:100%"></span></div>';
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
    [f.title, f.detail, f.file, f.recommendation]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
  const lines = [
    `<div class="finding f-${f.severity}" data-sev="${f.severity}" data-search="${search}">`,
    `<div class="f-head">` +
      `<span class="f-title">${escapeHtml(f.title)}</span>` +
      `<span class="f-badges"><span class="f-sev ${f.severity}">${sev.full}</span>` +
      `<span class="f-tag">${tag}</span></span></div>`,
  ];
  if (f.file) lines.push(`<div class="f-file">${escapeHtml(f.file)}</div>`);
  if (f.detail)
    lines.push(`<div class="f-detail">${escapeHtml(f.detail)}</div>`);
  if (f.recommendation)
    lines.push(
      `<div class="f-rec"><span class="f-rec-i">→</span> ${escapeHtml(f.recommendation)}</div>`,
    );
  lines.push("</div>");
  return lines.join("");
}

function renderFindingGroup(sev: Severity, items: Finding[]): string {
  if (items.length === 0) return "";
  const label = SEV[sev].full + (items.length === 1 ? "" : "s");
  return (
    `<section class="f-group f-group-${sev}">` +
    `<h4 class="f-group-h">${label} (${items.length})</h4>` +
    `<div class="findings">${items.map(renderFinding).join("")}</div>` +
    `</section>`
  );
}

function renderProject(
  report: HealthReport,
  opts: { scanRoot?: string; defaultOpen: boolean },
): string {
  const counts = summarize(report.findings);
  const name = projectName(report.root, opts.scanRoot);
  const badges = report.stacks
    .map((s) => `<span class="badge">${escapeHtml(s)}</span>`)
    .join("");
  const narrative = report.ai?.narrative
    ? cleanNarrative(report.ai.narrative)
    : "";
  const ai = narrative
    ? `<div class="ai"><div class="ai-h">AI summary</div><div class="ai-body">${escapeHtml(narrative)}</div></div>`
    : report.ai?.skipped
      ? `<div class="ai skipped"><div class="ai-h">AI summary</div><div class="ai-body">AI analysis skipped: ${escapeHtml(report.ai.skipped)}</div></div>`
      : "";

  const grouped = SEV_ORDER.map((sev) =>
    renderFindingGroup(
      sev,
      report.findings.filter((f) => f.severity === sev),
    ),
  ).join("");

  const findings = report.findings.length
    ? grouped
    : '<div class="clean">No findings — looks healthy.</div>';

  const fixPrompt = buildFixPrompt(report, name);
  const fixBlock = fixPrompt
    ? '<div class="fixprompt">' +
      '<details class="fix-details" open>' +
      '<summary class="fp-summary">' +
      '<span class="fp-title">Prompt to fix these with Claude</span>' +
      '<span class="fp-actions">' +
      '<button class="copy-btn" type="button">Copy</button>' +
      '<button class="open-claude-btn" type="button" disabled>' +
      '<svg class="claude-mark" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 1.6c.5 4.9 1.9 7.3 4.7 8.1 1.2.3 2.4.4 3.7.5-1.3.1-2.5.2-3.7.5-2.8.8-4.2 3.2-4.7 8.1-.5-4.9-1.9-7.3-4.7-8.1-1.2-.3-2.4-.4-3.7-.5 1.3-.1 2.5-.2 3.7-.5C10.1 8.9 11.5 6.5 12 1.6Z"/>' +
      "</svg>" +
      "<span>Open in Claude Code</span>" +
      '<span class="soon">Coming soon</span>' +
      "</button>" +
      "</span></summary>" +
      `<textarea class="fp-text" readonly rows="12" spellcheck="false">${escapeHtml(fixPrompt)}</textarea>` +
      "</details>" +
      "</div>"
    : "";

  const openAttr = opts.defaultOpen ? " open" : "";
  return (
    `<details class="project"${openAttr}>` +
    `<summary><span class="p-name">${escapeHtml(name)}</span>${badges}` +
    `<span class="p-chips">${countChips(counts)}</span></summary>` +
    '<div class="p-body">' +
    fixBlock +
    `<div class="path">${escapeHtml(report.root)}</div>` +
    bar(counts) +
    ai +
    findings +
    '<div class="filtered-note">No findings match the current filter.</div>' +
    "</div>" +
    "</details>"
  );
}

function verdictClass(totals: Record<Severity, number>): {
  cls: string;
  label: string;
} {
  if (totals.error > 0) return { cls: "action", label: "Action needed" };
  if (totals.warning > 0)
    return { cls: "review", label: "Review recommended" };
  return { cls: "healthy", label: "Looks healthy" };
}

function renderExecutiveSummary(
  reports: HealthReport[],
  totals: Record<Severity, number>,
): string {
  const projectCount = reports.length;
  const totalFindings = totals.error + totals.warning + totals.info;
  const { cls, label } = verdictClass(totals);

  const aiAnalyzed = reports.filter((r) => Boolean(r.ai?.narrative)).length;
  const aiSkipped = reports.filter((r) => Boolean(r.ai?.skipped)).length;
  const aiLine =
    aiAnalyzed > 0 || aiSkipped > 0
      ? `<div class="exec-ai">AI: ${aiAnalyzed}/${projectCount} project${projectCount === 1 ? "" : "s"} analyzed` +
        (aiSkipped > 0 ? ` · ${aiSkipped} skipped` : "") +
        `</div>`
      : "";

  if (totalFindings === 0) {
    return (
      '<section class="exec clean-state">' +
      `<div class="exec-verdict healthy">All clean</div>` +
      `<div class="exec-sub">No findings across ${projectCount} project${projectCount === 1 ? "" : "s"}.</div>` +
      aiLine +
      "</section>"
    );
  }

  const pill = (sev: string, n: number, name: string): string =>
    `<div class="pill ${sev}"><span class="pill-n">${n}</span><span class="pill-l">${name}</span></div>`;

  return (
    '<section class="exec">' +
    `<div class="exec-verdict ${cls}">${label}</div>` +
    '<div class="pills">' +
    pill("error", totals.error, "Errors") +
    pill("warning", totals.warning, "Warnings") +
    pill("info", totals.info, "Info") +
    pill(
      "projects",
      projectCount,
      projectCount === 1 ? "Project" : "Projects",
    ) +
    "</div>" +
    aiLine +
    "</section>"
  );
}

const STYLE = `
:root{--bg:#f4f6f9;--panel:#fff;--panel-2:#f8fafc;--fg:#1e293b;--muted:#64748b;--border:#e2e8f0;
--error:#c24141;--warning:#b45309;--info:#2563eb;--ok:#15803d;
--brand-a:#0891b2;--brand-b:#c0267a;--claude:#d97757;--claude-ink:#c15f3c;
--shadow:0 1px 2px rgba(15,23,42,.04),0 4px 16px rgba(15,23,42,.05)}
@media(prefers-color-scheme:dark){:root{--bg:#0f1218;--panel:#161b24;--panel-2:#1c2330;--fg:#e2e8f0;--muted:#94a3b8;--border:#2a3344;
--error:#f87171;--warning:#fbbf24;--info:#60a5fa;--ok:#4ade80;
--brand-a:#22d3ee;--brand-b:#e879c9;--claude:#e08a6d;--claude-ink:#e08a6d;
--shadow:0 1px 2px rgba(0,0,0,.25),0 8px 24px rgba(0,0,0,.3)}}
*{box-sizing:border-box}
body{margin:0;font:15px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg);
-webkit-font-smoothing:antialiased}
a{color:var(--info)}
/* Hero — restrained, single tone */
header.hero{background:var(--panel);border-bottom:1px solid var(--border)}
.hero-inner{max-width:920px;margin:0 auto;padding:28px 28px 22px}
.brand{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand-name{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1;
background:linear-gradient(90deg,var(--brand-a),var(--brand-b));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-author{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);
padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--panel-2)}
.meta{color:var(--muted);font-size:13px;margin-top:10px}
/* Executive summary */
.exec{max-width:920px;margin:20px auto 0;padding:22px 24px;background:var(--panel);border:1px solid var(--border);
border-radius:14px;box-shadow:var(--shadow)}
.exec-verdict{font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:14px}
.exec-verdict.healthy{color:var(--ok)}.exec-verdict.review{color:var(--warning)}.exec-verdict.action{color:var(--error)}
.exec-sub{color:var(--muted);font-size:14px;margin-top:-6px;margin-bottom:4px}
.exec.clean-state{text-align:center;padding:32px 24px}
.exec-ai{margin-top:14px;font-size:12.5px;color:var(--muted)}
.pills{display:flex;gap:12px;flex-wrap:wrap}
.pill{flex:1;min-width:100px;background:var(--panel-2);border:1px solid var(--border);border-radius:10px;
padding:12px 14px;position:relative;overflow:hidden}
.pill::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
.pill.error::before{background:var(--error)}.pill.warning::before{background:var(--warning)}
.pill.info::before{background:var(--info)}.pill.projects::before{background:linear-gradient(var(--brand-a),var(--brand-b))}
.pill-n{display:block;font-size:22px;font-weight:800;line-height:1.15}
.pill.error .pill-n{color:var(--error)}.pill.warning .pill-n{color:var(--warning)}.pill.info .pill-n{color:var(--info)}
.pill-l{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px;font-weight:600}
/* Toolbar */
.toolbar{position:sticky;top:0;z-index:6;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(8px);
border-bottom:1px solid var(--border);padding:10px 28px;margin-top:20px}
.toolbar .tb-inner{max-width:920px;margin:0 auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:100%}
.toolbar label{display:inline-flex;align-items:center;gap:6px;color:var(--fg);font-size:13px;cursor:pointer;
padding:5px 12px;border:1px solid var(--border);border-radius:999px;background:var(--panel);user-select:none}
.toolbar label:hover{border-color:var(--info)}
.toolbar .spacer{flex:1}
.toolbar input[type=search]{padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:var(--panel);color:var(--fg);min-width:200px}
.toolbar input[type=search]:focus{outline:none;border-color:var(--info);box-shadow:0 0 0 3px color-mix(in srgb,var(--info) 18%,transparent)}
.toolbar button{padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:var(--panel);color:var(--fg);cursor:pointer;font-weight:600;font-size:13px}
.toolbar button:hover{border-color:var(--info);color:var(--info)}
main{padding:16px 28px 56px;max-width:920px;margin:0 auto}
/* Chips */
.chip{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px;color:#fff}
.chip.error{background:var(--error)}.chip.warning{background:var(--warning)}.chip.info{background:var(--info)}
.chip.ok{background:var(--ok)}.chip.zero{opacity:.28}
/* Project card */
.project{background:var(--panel);border:1px solid var(--border);border-radius:14px;margin:18px 0;overflow:hidden;box-shadow:var(--shadow)}
.project>summary{list-style:none;cursor:pointer;padding:16px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
border-left:4px solid transparent;transition:background .12s}
.project>summary:hover{background:var(--panel-2)}
.project>summary::-webkit-details-marker{display:none}
.project>summary::before{content:"▸";color:var(--muted);font-size:12px;transition:transform .12s;display:inline-block}
.project[open]>summary::before{transform:rotate(90deg)}
.p-name{font-weight:800;font-size:16px}
.p-chips{margin-left:auto;display:flex;align-items:center}
.badge{font-size:11px;font-weight:600;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 8px;background:var(--panel-2)}
.p-body{padding:4px 20px 22px}
.path{color:var(--muted);font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;margin-bottom:12px}
.bar{display:flex;height:6px;border-radius:999px;overflow:hidden;background:var(--border);margin-bottom:18px}
.seg{display:block;height:100%}.seg.error{background:var(--error)}.seg.warning{background:var(--warning)}.seg.info{background:var(--info)}.seg.ok{background:var(--ok)}
/* AI summary */
.ai{border:1px solid color-mix(in srgb,var(--info) 22%,var(--border));background:color-mix(in srgb,var(--info) 5%,var(--panel));
padding:14px 16px;border-radius:10px;margin-bottom:18px}
.ai-h{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--info);margin-bottom:8px}
.ai-body{white-space:pre-wrap;line-height:1.7}
.ai.skipped{color:var(--muted);border-style:dashed;background:transparent}
.ai.skipped .ai-h{color:var(--muted)}
/* Finding groups */
.f-group{margin-bottom:20px}
.f-group.hidden{display:none}
.f-group-h{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px;color:var(--muted)}
.f-group-error .f-group-h{color:var(--error)}
.f-group-warning .f-group-h{color:var(--warning)}
.f-group-info .f-group-h{color:var(--info)}
/* Findings */
.findings{display:flex;flex-direction:column;gap:12px}
.finding{border:1px solid var(--border);border-left:4px solid var(--muted);border-radius:10px;padding:14px 16px;background:var(--panel-2)}
.finding.f-error{border-left-color:var(--error)}.finding.f-warning{border-left-color:var(--warning)}.finding.f-info{border-left-color:var(--info)}
.f-head{display:flex;align-items:flex-start;gap:12px}
.f-title{font-weight:700;font-size:15px;line-height:1.4;flex:1}
.f-badges{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding-top:2px}
.f-sev{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;color:#fff}
.f-sev.error{background:var(--error)}.f-sev.warning{background:var(--warning)}.f-sev.info{background:var(--info)}
.f-tag{font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:1px 7px;background:var(--panel)}
.f-file{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--muted);margin-top:8px}
.f-detail{margin-top:8px;color:var(--fg);line-height:1.65}
.f-rec{margin-top:10px;color:var(--ok);background:color-mix(in srgb,var(--ok) 7%,transparent);border-radius:8px;padding:8px 12px;font-size:13.5px;line-height:1.55}
.f-rec-i{font-weight:800}
.clean{color:var(--ok);font-weight:700;padding:18px;text-align:center;background:color-mix(in srgb,var(--ok) 7%,transparent);border-radius:10px}
.filtered-note{display:none;color:var(--muted);padding:14px;text-align:center}
.project.filtered-empty .f-group,.project.filtered-empty .findings,.project.filtered-empty .clean{display:none}
.project.filtered-empty .filtered-note{display:block}
/* Fix prompt — first thing in the project body */
.fixprompt{margin:0 0 18px;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.fix-details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
background:var(--panel-2);padding:12px 16px;font-size:13px;font-weight:700;color:var(--fg)}
.fix-details>summary::-webkit-details-marker{display:none}
.fix-details>summary::before{content:"▸";color:var(--muted);font-size:11px;margin-right:8px;transition:transform .12s;display:inline-block}
.fix-details[open]>summary::before{transform:rotate(90deg)}
.fp-summary{user-select:none}
.fp-title{flex:1}
.fp-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.copy-btn{cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--fg);border-radius:999px;padding:5px 14px;font-size:12px;font-weight:700}
.copy-btn:hover{border-color:var(--brand-b);color:var(--brand-b)}
.open-claude-btn{cursor:not-allowed;border:1px solid color-mix(in srgb,var(--claude) 55%,var(--border));
background:color-mix(in srgb,var(--claude) 12%,transparent);color:var(--claude-ink);
border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}
.open-claude-btn .claude-mark{color:var(--claude);flex:0 0 auto}
.soon{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:999px;
border:1px solid color-mix(in srgb,var(--claude) 45%,var(--border));background:color-mix(in srgb,var(--claude) 16%,transparent);color:var(--claude-ink)}
.fp-text{display:block;width:100%;border:0;border-top:1px solid var(--border);background:var(--panel);color:var(--fg);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.6;padding:14px 16px;resize:vertical}
/* Print */
@media print{
  .toolbar{display:none!important}
  body{background:#fff;color:#111}
  .exec,.project{box-shadow:none;break-inside:avoid}
  details.project{display:block}
  details.project>summary{display:flex}
  details.project>.p-body,details.project[open]>.p-body{display:block!important}
  .fix-details,.fixprompt{display:none!important}
  header.hero{border-bottom:1px solid #ccc}
}
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
  "    var groups = document.querySelectorAll('.f-group');",
  "    for (var g=0;g<groups.length;g++){",
  "      var fs = groups[g].querySelectorAll('.finding');",
  "      var visible=0;",
  "      for (var h=0;h<fs.length;h++){ if (fs[h].style.display !== 'none') visible++; }",
  "      groups[g].classList.toggle('hidden', fs.length>0 && visible===0);",
  "    }",
  "    var projects = document.querySelectorAll('.project');",
  "    for (var j=0;j<projects.length;j++){",
  "      var pfs = projects[j].querySelectorAll('.finding');",
  "      var any=false;",
  "      for (var k=0;k<pfs.length;k++){ if (pfs[k].style.display !== 'none'){ any=true; break; } }",
  "      projects[j].classList.toggle('filtered-empty', pfs.length>0 && !any);",
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
  "      btn.addEventListener('click', function(ev){",
  "        ev.preventDefault(); ev.stopPropagation();",
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
export function buildHtml(
  reports: HealthReport[],
  opts: BuildHtmlOptions = {},
): string {
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
  const defaultOpen = projectCount === 1;
  const body = reports
    .map((r) =>
      renderProject(r, { scanRoot: opts.scanRoot, defaultOpen }),
    )
    .join("\n");

  const exec = renderExecutiveSummary(reports, totals);

  const toolbar =
    '<div class="toolbar"><div class="tb-inner">' +
    '<label><input type="checkbox" data-sev="error" checked> Errors</label>' +
    '<label><input type="checkbox" data-sev="warning" checked> Warnings</label>' +
    '<label><input type="checkbox" data-sev="info" checked> Info</label>' +
    '<input id="search" type="search" placeholder="Filter findings…">' +
    '<span class="spacer"></span>' +
    '<button id="expandAll" type="button">Expand all</button>' +
    '<button id="collapseAll" type="button">Collapse all</button>' +
    "</div></div>";

  return (
    "<!doctype html>\n" +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escapeHtml(APP_NAME)} report</title><style>${STYLE}</style></head><body>` +
    '<header class="hero"><div class="hero-inner">' +
    '<div class="brand">' +
    `<span class="brand-name">${escapeHtml(APP_NAME)}</span>` +
    `<span class="brand-author">${escapeHtml(AUTHOR)}</span>` +
    "</div>" +
    `<div class="meta">${projectCount} project${projectCount === 1 ? "" : "s"} analyzed · generated ${escapeHtml(formatGeneratedAt(generatedAt))}</div>` +
    "</div></header>" +
    exec +
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
export function emitHtmlReport(
  reports: HealthReport[],
  opts: EmitOptions,
): void {
  const html = buildHtml(reports, { scanRoot: opts.scanRoot });
  const abs = writeReport(html, opts.outPath);
  console.error(pc.dim(`  report written: ${abs}`));
  if (opts.open) openInBrowser(abs);
}
