import { useMemo } from 'react'

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header' | 'hunk'
  oldLine: number | null
  newLine: number | null
  content: string
  selected?: boolean
  onToggle?: () => void
}

interface Props {
  diff: string
  fileName?: string
  selectable?: boolean
  selectedLines?: Set<string>
  onToggleLine?: (key: string, type: 'add' | 'del') => void
}

function parseDiff(diffText: string): { header: string; hunks: { header: string; lines: DiffLine[] }[] } {
  const lines = diffText.split('\n')
  let header = ''
  const hunks: { header: string; lines: DiffLine[] }[] = []
  let currentHunk: { header: string; lines: DiffLine[] } | null = null
  let oldLine = 0
  let newLine = 0
  let headerLines: string[] = []
  let i = 0

  while (i < lines.length && (lines[i].startsWith('diff --git') || lines[i].startsWith('index ') || lines[i].startsWith('---') || lines[i].startsWith('+++') || lines[i].startsWith('Binary') || lines[i] === '')) {
    if (lines[i].startsWith('---') || lines[i].startsWith('+++') || lines[i].startsWith('diff --git')) {
      headerLines.push(lines[i])
    }
    i++
  }
  header = headerLines.join('\n')

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = { header: line, lines: [] }
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1]) - 1
        newLine = parseInt(match[2]) - 1
      }
      i++
    } else if (currentHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        newLine++
        currentHunk.lines.push({ type: 'add', oldLine: null, newLine, content: line.slice(1) })
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        oldLine++
        currentHunk.lines.push({ type: 'del', oldLine, newLine: null, content: line.slice(1) })
      } else if (line.startsWith('\\')) {
        currentHunk.lines.push({ type: 'context', oldLine: null, newLine: null, content: line })
      } else {
        oldLine++
        newLine++
        currentHunk.lines.push({ type: 'context', oldLine, newLine, content: line.startsWith(' ') ? line.slice(1) : line })
      }
      i++
    } else {
      i++
    }
  }
  if (currentHunk) hunks.push(currentHunk)
  return { header, hunks }
}

export default function DiffViewer({ diff, fileName, selectable, selectedLines, onToggleLine }: Props) {
  const parsed = useMemo(() => parseDiff(diff), [diff])

  if (!diff) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div className="empty-state-icon">📄</div>
        <div className="empty-state-desc">暂无 diff 内容</div>
      </div>
    )
  }

  return (
    <div className="diff-container" style={{ height: '100%' }}>
      {fileName && (
        <div className="diff-header">
          📄 {fileName}
        </div>
      )}
      {parsed.hunks.length === 0 ? (
        <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
          {diff}
        </div>
      ) : (
        parsed.hunks.map((hunk, hIdx) => (
          <div key={hIdx}>
            <div className="diff-hunk-header">{hunk.header}</div>
            {hunk.lines.map((line, lIdx) => {
              const key = `${hIdx}-${lIdx}`
              const isChange = line.type === 'add' || line.type === 'del'
              const isSelected = selectedLines?.has(key)
              return (
                <div
                  key={lIdx}
                  className={`diff-line diff-${line.type === 'context' ? 'ctx' : line.type}`}
                  style={{
                    background: isSelected ? (line.type === 'add' ? 'rgba(16, 124, 16, 0.4)' : 'rgba(209, 52, 56, 0.4)') : undefined,
                    cursor: selectable && isChange ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (selectable && isChange && onToggleLine) {
                      onToggleLine(key, line.type as 'add' | 'del')
                    }
                  }}
                >
                  {selectable && isChange && (
                    <div style={{
                      width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isSelected ? 1 : 0.4
                    }}>
                      {isSelected ? '☑' : '☐'}
                    </div>
                  )}
                  <div className="diff-line-number">
                    {line.oldLine || ''}
                  </div>
                  <div className="diff-line-number">
                    {line.newLine || ''}
                  </div>
                  <div className="diff-line-marker">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                  </div>
                  <div className="diff-line-content">{line.content || ' '}</div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
