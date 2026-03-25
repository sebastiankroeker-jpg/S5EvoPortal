// ScopeBoard Activity Log (JSONL)
// Expected format per line: {ts, actor, type, scope, summary, meta?}

export async function loadActivity(url = '../activity.jsonl') {
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
  items.sort((a, b) => String(b.ts).localeCompare(String(a.ts))); // newest first
  return items;
}

export function renderActivity(el, items, { limit = 50 } = {}) {
  const rows = items.slice(0, limit).map(it => {
    const ts = escapeHtml(String(it.ts || ''));
    const actor = escapeHtml(String(it.actor || ''));
    const type = escapeHtml(String(it.type || ''));
    const scope = escapeHtml(String(it.scope || ''));
    const summary = escapeHtml(String(it.summary || ''));
    return `<tr>
      <td><code>${ts}</code></td>
      <td>${actor}</td>
      <td>${type}</td>
      <td>${scope}</td>
      <td class="muted">${summary}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:190px;">TS (UTC)</th>
          <th style="width:120px;">Actor</th>
          <th style="width:120px;">Type</th>
          <th style="width:140px;">Scope</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">(no activity)</td></tr>`}</tbody>
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
