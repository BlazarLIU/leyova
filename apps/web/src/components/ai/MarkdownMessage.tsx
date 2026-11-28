import type { ReactNode } from 'react'

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-[var(--text-primary)]">{part.slice(2, -2)}</strong>
      : part
  )
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={i} className="font-semibold text-[var(--text-primary)] mt-3 mb-1">{line.slice(2, -2)}</p>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 text-[var(--text-secondary)] list-disc marker:text-orbit-primary">
          {formatInline(line.slice(2))}
        </li>
      )
    } else if (line.startsWith('| ') && line.includes('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| :]+\|$/)) {
          rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()))
        }
        i++
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-orbit-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orbit-border bg-orbit-surface2">
                {rows[0]?.map((h, j) => (
                  <th key={j} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, j) => (
                <tr key={j} className="border-b border-orbit-border last:border-0 hover:bg-white/2">
                  {row.map((cell, k) => (
                    <td key={k} className="px-3 py-2 text-[var(--text-muted)]">{formatInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
    } else {
      elements.push(<p key={i} className="text-[var(--text-secondary)] leading-relaxed">{formatInline(line)}</p>)
    }
    i++
  }

  return <div className="text-sm space-y-0.5">{elements}</div>
}
