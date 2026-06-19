/**
 * Minimal markdown → HTML voor de site-content.
 *
 * Geen externe dependency: dekt H2/H3, paragraaf, fett/cursief, links,
 * inline code, lijsten, tabellen (eenvoudig). Voldoende voor de
 * beheerbare pagina-teksten; voor complexe content kan een admin
 * altijd raw HTML inplakken (de output van deze renderer escapet
 * niets — dat is bewust, de pages-tabel is alleen admin-bewerkbaar).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s: string): string {
  // Links: [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, t, u) => `<a href="${escapeHtml(u)}">${escapeHtml(t)}</a>`
  );
  // **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *italic* / _italic_
  s = s.replace(/(?<!\w)[\*_]([^*_\n]+)[\*_](?!\w)/g, '<em>$1</em>');
  // `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  const flushPara = (chunks: string[]) => {
    if (chunks.length === 0) return;
    out.push(`<p>${inline(chunks.join(' '))}</p>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const h = /^(#{2,4})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Tabel (pipe-stijl, met scheidingsregel)
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1])) {
      const headerCells = line
        .slice(1, -1)
        .split('|')
        .map((c) => inline(c.trim()));
      const rows: string[][] = [];
      i += 2; // skip separator
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(
          lines[i].slice(1, -1).split('|').map((c) => inline(c.trim()))
        );
        i++;
      }
      out.push('<table>');
      out.push(
        '<thead><tr>' + headerCells.map((c) => `<th>${c}</th>`).join('') + '</tr></thead>'
      );
      out.push('<tbody>');
      for (const r of rows) {
        out.push('<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>');
      }
      out.push('</tbody></table>');
      continue;
    }

    // Ongeordende lijst
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^[-*]\s+/, '')));
        i++;
      }
      out.push('<ul>' + items.map((x) => `<li>${x}</li>`).join('') + '</ul>');
      continue;
    }

    // Lege regel
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraaf — gather tot lege regel of speciaal blok
    const chunks: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{2,4}\s|[-*]\s|\|)/.test(lines[i])
    ) {
      chunks.push(lines[i]);
      i++;
    }
    flushPara(chunks);
  }

  return out.join('\n');
}
