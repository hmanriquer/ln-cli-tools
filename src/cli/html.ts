import path from "node:path";
import pc from "picocolors";
import { summarize } from "../core/report.js";
import { buildFixPrompt } from "../core/fixPrompt.js";
import { cleanNarrative } from "../core/narrative.js";
import type { Finding, HealthReport, Severity } from "../core/types.js";
import { openInBrowser, writeReport } from "../infra/reportOutput.js";
import { APP_NAME, AUTHOR } from "./brand.js";

const SEV: Record<Severity, { icon: string; label: string; full: string }> = {
  error: { icon: "✖", label: "err", full: "Error" },
  warning: { icon: "⚠", label: "warn", full: "Warning" },
  info: { icon: "•", label: "info", full: "Info" },
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
    `<div class="f-head"><span class="f-icon ${f.severity}">${sev.icon}</span>` +
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

function renderProject(report: HealthReport, scanRoot?: string): string {
  const counts = summarize(report.findings);
  const name = projectName(report.root, scanRoot);
  const badges = report.stacks
    .map((s) => `<span class="badge">${escapeHtml(s)}</span>`)
    .join("");
  const narrative = report.ai?.narrative
    ? cleanNarrative(report.ai.narrative)
    : "";
  const ai = narrative
    ? `<div class="ai"><div class="ai-h">AI summary</div><div class="ai-body">${escapeHtml(narrative)}</div></div>`
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
    fixBlock +
    ai +
    `<div class="findings">${findings}</div>` +
    '<div class="filtered-note">No findings match the current filter.</div>' +
    "</div>" +
    "</details>"
  );
}

const STYLE = `
:root{--bg:#eef1f6;--panel:#fff;--panel-2:#f7f9fc;--fg:#1b2230;--muted:#657085;--border:#e2e7f0;
--error:#e0393f;--warning:#c07f16;--info:#1a76d2;--ok:#12a06a;
--brand-a:#22b8cf;--brand-b:#d6499b;--shadow:0 1px 2px rgba(20,30,50,.06),0 8px 24px rgba(20,30,50,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#0c0f14;--panel:#151a22;--panel-2:#1b212b;--fg:#e6e9ef;--muted:#94a0b3;--border:#252c38;
--error:#ff6169;--warning:#e6bb46;--info:#5ab0ff;--ok:#3ed99a;
--brand-a:#38d6e6;--brand-b:#ff63b3;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35)}}
*{box-sizing:border-box}
body{margin:0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg);
-webkit-font-smoothing:antialiased}
a{color:var(--info)}
/* Hero */
header.hero{position:relative;overflow:hidden;background:
radial-gradient(1200px 300px at 10% -40%,color-mix(in srgb,var(--brand-a) 40%,transparent),transparent),
radial-gradient(1000px 300px at 90% -60%,color-mix(in srgb,var(--brand-b) 40%,transparent),transparent),var(--panel);
border-bottom:1px solid var(--border)}
.hero-inner{max-width:1040px;margin:0 auto;padding:26px 24px 20px}
.brand{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand-name{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1;
background:linear-gradient(90deg,var(--brand-a),var(--brand-b));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-author{font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#fff;
padding:4px 12px;border-radius:999px;background:linear-gradient(90deg,var(--brand-a),var(--brand-b));
box-shadow:0 2px 8px color-mix(in srgb,var(--brand-b) 40%,transparent)}
.meta{color:var(--muted);font-size:12.5px;margin-top:10px}
/* Stat cards */
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.stat{flex:1;min-width:120px;background:var(--panel);border:1px solid var(--border);border-radius:12px;
padding:12px 14px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.stat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}
.stat.error::before{background:var(--error)}.stat.warning::before{background:var(--warning)}
.stat.info::before{background:var(--info)}.stat.projects::before{background:linear-gradient(var(--brand-a),var(--brand-b))}
.stat-n{display:block;font-size:24px;font-weight:800;line-height:1.1}
.stat.error .stat-n{color:var(--error)}.stat.warning .stat-n{color:var(--warning)}.stat.info .stat-n{color:var(--info)}
.stat-l{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px;font-weight:600}
/* Toolbar */
.toolbar{position:sticky;top:0;z-index:6;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);
border-bottom:1px solid var(--border);padding:10px 24px}
.toolbar .tb-inner{max-width:1040px;margin:0 auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:100%}
.toolbar label{display:inline-flex;align-items:center;gap:6px;color:var(--fg);font-size:13px;cursor:pointer;
padding:5px 10px;border:1px solid var(--border);border-radius:999px;background:var(--panel);user-select:none}
.toolbar label:hover{border-color:var(--info)}
.toolbar .spacer{flex:1}
.toolbar input[type=search]{padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--panel);color:var(--fg);min-width:220px}
.toolbar input[type=search]:focus{outline:none;border-color:var(--info);box-shadow:0 0 0 3px color-mix(in srgb,var(--info) 20%,transparent)}
.toolbar button{padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:var(--panel);color:var(--fg);cursor:pointer;font-weight:600}
.toolbar button:hover{border-color:var(--info);color:var(--info)}
main{padding:20px 24px 48px;max-width:1040px;margin:0 auto}
/* Chips */
.chip{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px;color:#fff}
.chip.error{background:var(--error)}.chip.warning{background:var(--warning)}.chip.info{background:var(--info)}
.chip.ok{background:var(--ok)}.chip.zero{opacity:.25}
/* Project card */
.project{background:var(--panel);border:1px solid var(--border);border-radius:14px;margin:16px 0;overflow:hidden;box-shadow:var(--shadow)}
.project>summary{list-style:none;cursor:pointer;padding:16px 18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
border-left:4px solid transparent;transition:background .15s}
.project>summary:hover{background:var(--panel-2)}
.project>summary::-webkit-details-marker{display:none}
.project>summary::before{content:"▸";color:var(--muted);font-size:12px;transition:transform .15s;display:inline-block}
.project[open]>summary::before{transform:rotate(90deg)}
.p-name{font-weight:800;font-size:16px}
.p-chips{margin-left:auto;display:flex;align-items:center}
.badge{font-size:11px;font-weight:600;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 8px;background:var(--panel-2)}
.p-body{padding:4px 18px 18px}
.path{color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;margin-bottom:10px}
.bar{display:flex;height:8px;border-radius:999px;overflow:hidden;background:var(--border);margin-bottom:16px}
.seg{display:block;height:100%}.seg.error{background:var(--error)}.seg.warning{background:var(--warning)}.seg.info{background:var(--info)}.seg.ok{background:var(--ok)}
/* AI summary */
.ai{border:1px solid color-mix(in srgb,var(--info) 30%,var(--border));background:color-mix(in srgb,var(--info) 7%,var(--panel));
padding:12px 14px;border-radius:10px;margin-bottom:16px}
.ai-h{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--info);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.ai-h::before{content:"✦"}
.ai.skipped{color:var(--muted);border-style:dashed;background:transparent}
.ai.skipped .ai-h{color:var(--muted)}
/* Findings */
.findings{display:flex;flex-direction:column;gap:10px}
.finding{border:1px solid var(--border);border-left:4px solid var(--muted);border-radius:10px;padding:12px 14px;background:var(--panel-2)}
.finding.f-error{border-left-color:var(--error)}.finding.f-warning{border-left-color:var(--warning)}.finding.f-info{border-left-color:var(--info)}
.f-head{display:flex;align-items:center;gap:10px}
.f-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:13px;flex:0 0 auto;color:#fff}
.f-icon.error{background:var(--error)}.f-icon.warning{background:var(--warning)}.f-icon.info{background:var(--info)}
.f-title{font-weight:700}
.f-badges{margin-left:auto;display:flex;align-items:center;gap:6px;flex:0 0 auto}
.f-sev{font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;color:#fff}
.f-sev.error{background:var(--error)}.f-sev.warning{background:var(--warning)}.f-sev.info{background:var(--info)}
.f-tag{font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:0 6px;background:var(--panel)}
.f-file{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--muted);margin-top:6px}
.f-detail{margin-top:6px;color:var(--fg)}
.f-rec{margin-top:8px;color:var(--ok);background:color-mix(in srgb,var(--ok) 8%,transparent);border-radius:8px;padding:6px 10px;font-size:13px}
.f-rec-i{font-weight:800}
.clean{color:var(--ok);font-weight:700;padding:14px;text-align:center;background:color-mix(in srgb,var(--ok) 8%,transparent);border-radius:10px}
.filtered-note{display:none;color:var(--muted);padding:12px;text-align:center}
.project.filtered-empty .findings{display:none}.project.filtered-empty .filtered-note{display:block}
/* Fix prompt */
.fixprompt{margin-bottom:16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}
.fp-head{display:flex;align-items:center;justify-content:space-between;
background:linear-gradient(90deg,color-mix(in srgb,var(--brand-a) 18%,var(--panel)),color-mix(in srgb,var(--brand-b) 18%,var(--panel)));
padding:10px 14px;font-size:13px;font-weight:800;color:var(--fg)}
.copy-btn{cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--fg);border-radius:999px;padding:5px 16px;font-size:12px;font-weight:700}
.copy-btn:hover{border-color:var(--brand-b);color:var(--brand-b)}
.fp-text{display:block;width:100%;border:0;border-top:1px solid var(--border);background:var(--panel);color:var(--fg);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.6;padding:14px;resize:vertical}
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
  const body = reports.map((r) => renderProject(r, opts.scanRoot)).join("\n");

  const statCard = (cls: string, n: number, label: string): string =>
    `<div class="stat ${cls}"><span class="stat-n">${n}</span><span class="stat-l">${label}</span></div>`;
  const stats =
    '<div class="stats">' +
    statCard("error", totals.error, "Errors") +
    statCard("warning", totals.warning, "Warnings") +
    statCard("info", totals.info, "Info") +
    statCard(
      "projects",
      projectCount,
      projectCount === 1 ? "Project" : "Projects",
    ) +
    "</div>";

  const toolbar =
    '<div class="toolbar"><div class="tb-inner">' +
    '<label><input type="checkbox" data-sev="error" checked> Errors</label>' +
    '<label><input type="checkbox" data-sev="warning" checked> Warnings</label>' +
    '<label><input type="checkbox" data-sev="info" checked> Info</label>' +
    '<input id="search" type="search" placeholder="Filter findings…">' +
    '<span class="spacer"></span>' +
    '<button id="expandAll">Expand all</button>' +
    '<button id="collapseAll">Collapse all</button>' +
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
    `<div class="meta">${projectCount} project${projectCount === 1 ? "" : "s"} analyzed · generated ${escapeHtml(generatedAt)}</div>` +
    stats +
    "</div></header>" +
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
