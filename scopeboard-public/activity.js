// ScopeBoard Activity Log (JSONL)
// Line format: JSON object. Recommended fields:
// { ts, actor, type, runId?, scope?, status?, summary, meta? }

export async function loadActivity(url = './activity.jsonl') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load activity log: ' + res.status);
  const text = await res.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const l of lines) {
    try {
      const obj = JSON.parse(l);
      if (!obj.ts) continue;
      items.push(obj);
    } catch {
      // ignore
    }
  }
  // newest first
  items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return items;
}

export function computeRunning(items, { types = ['build', 'deploy'] } = {}) {
  // Detect start/end pairs by runId.
  const endByRun = new Set();
  for (const it of items) {
    if (it.runId && typeof it.type === 'string' && it.type.endsWith('.end')) {
      endByRun.add(it.runId);
    }
  }

  const running = [];
  for (const it of items) {
    if (!it.runId || typeof it.type !== 'string') continue;
    const base = it.type.split('.')[0];
    if (!types.includes(base)) continue;
    if (it.type.endsWith('.start') && !endByRun.has(it.runId)) running.push(it);
  }
  // oldest first
  running.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return running;
}

export function renderRunning(el, running) {
  if (!el) return;
  if (!running.length) {
    el.innerHTML = '<span class="muted">0 running</span>';
    return;
  }

  const rows = running.map(it => {
    const ts = escapeHtml(String(it.ts || ''));
    const type = escapeHtml(String(it.type || ''));
    const scope = escapeHtml(String(it.scope || ''));
    const runId = escapeHtml(String(it.runId || ''));
    const summary = escapeHtml(String(it.summary || ''));
    return `<div style="margin-top:6px;">
      <span class="chip" data-status="IN_PROGRESS">RUNNING</span>
      <code style="margin-left:8px;">${type}</code>
      <span class="muted" style="margin-left:8px;">${ts}</span>
      <div class="muted" style="margin-top:4px;">${summary} <span style="opacity:.7">(${scope} · ${runId})</span></div>
    </div>`;
  }).join('');

  el.innerHTML = `<div><strong>${running.length}</strong> running</div>${rows}`;
}

export function renderActivity(el, items, { limit = 50 } = {}) {
  const rows = items.slice(0, limit).map(it => {
    const ts = escapeHtml(String(it.ts || ''));
    const actor = escapeHtml(String(it.actor || ''));
    const type = escapeHtml(String(it.type || ''));
    const scope = escapeHtml(String(it.scope || ''));
    const status = escapeHtml(String(it.status || ''));
    const summary = escapeHtml(String(it.summary || ''));
    const runId = escapeHtml(String(it.runId || ''));
    return `<tr>
      <td><code>${ts}</code></td>
      <td>${actor}</td>
      <td>${type}</td>
      <td>${scope}</td>
      <td>${status}</td>
      <td class="muted">${summary}${runId ? ` <span style="opacity:.7">(${runId})</span>` : ''}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:190px;">TS (UTC)</th>
          <th style="width:120px;">Actor</th>
          <th style="width:140px;">Type</th>
          <th style="width:90px;">Scope</th>
          <th style="width:90px;">Status</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">(no activity)</td></tr>`}</tbody>
    </table>
  `;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
