import { useState, useEffect, useMemo } from 'react'
import { Commit, CommitFile } from '../types/git'
import DiffViewer from './DiffViewer'

interface Props {
  commits: Commit[]
  selectedCommit: Commit | null
  onSelectCommit: (commit: Commit | null) => void
  repoPath: string
}

const COLORS = ['#0078d4', '#107c10', '#d83b01', '#5c2d91', '#e3008c', '#00b7c3', '#8764b8', '#f2c744']

function buildTreeData(commits: Commit[]) {
  const columns: (string | null)[] = []
  const rows: { commit: Commit; col: number; markers: { row: number; col: number; type: string; color: string }[] }[] = []

  const hashToIdx = new Map(commits.map((c, i) => [c.hash, i]))

  commits.forEach((commit, rowIdx) => {
    let col = columns.findIndex(c => c === commit.hash)
    if (col === -1) {
      col = columns.findIndex(c => c === null)
      if (col === -1) {
        col = columns.length
        columns.push(commit.hash)
      } else {
        columns[col] = commit.hash
      }
    }

    const markers: { row: number; col: number; type: string; color: string }[] = []
    markers.push({ row: rowIdx, col, type: 'commit', color: COLORS[col % COLORS.length] })

    columns[col] = null
    rows.push({ commit, col, markers })
  })

  const maxCols = Math.max(...rows.map(r => r.col)) + 2
  return { rows, maxCols }
}

export default function CommitHistory({ commits, selectedCommit, onSelectCommit, repoPath }: Props) {
  const [files, setFiles] = useState<CommitFile[]>([])
  const [diff, setDiff] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const treeData = useMemo(() => buildTreeData(commits), [commits])

  const filteredCommits = useMemo(() => {
    if (!search) return showAll ? commits : commits.slice(0, 100)
    const s = search.toLowerCase()
    return commits.filter(c =>
      c.message.toLowerCase().includes(s) ||
      c.author_name.toLowerCase().includes(s) ||
      c.hash.startsWith(s) ||
      c.branches.some(b => b.toLowerCase().includes(s))
    )
  }, [commits, search, showAll])

  useEffect(() => {
    if (selectedCommit) {
      loadCommitData(selectedCommit.hash)
    } else {
      setFiles([])
      setDiff('')
      setSelectedFile(null)
    }
  }, [selectedCommit])

  useEffect(() => {
    setFiles([])
    setDiff('')
    setSelectedFile(null)
    setSearch('')
    setShowAll(false)
  }, [repoPath])

  const loadCommitData = async (hash: string) => {
    try {
      const [f, d] = await Promise.all([
        window.gitApi.getCommitFiles(repoPath, hash),
        window.gitApi.getCommitDiff(repoPath, hash)
      ])
      setFiles(f)
      setDiff(d)
      setSelectedFile(null)
    } catch (e) {
      console.error(e)
    }
  }

  const loadFileDiff = async (filePath: string, hash: string) => {
    try {
      const d = await window.gitApi.getCommitDiff(repoPath, hash, filePath)
      setDiff(d || (await window.gitApi.getCommitDiff(repoPath, hash)))
      setSelectedFile(filePath)
    } catch (e) {
      console.error(e)
    }
  }

  const rowHeight = 28
  const colWidth = 20
  const treeWidth = Math.min(treeData.maxCols * colWidth, 120)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, borderRight: '1px solid var(--border-color)' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0
        }}>
          <input
            type="text"
            placeholder="🔍 搜索提交信息、作者、哈希或分支..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {!search && !showAll && commits.length > 100 && (
            <button className="btn btn-secondary" onClick={() => setShowAll(true)}>
              显示全部 ({commits.length})
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div className="commits-container">
            {filteredCommits.map((commit, idx) => {
              const actualIdx = commits.indexOf(commit)
              const treeRow = treeData.rows[actualIdx] || treeData.rows[0]
              const isSelected = selectedCommit?.hash === commit.hash
              return (
                <div
                  key={commit.hash}
                  className={`commit-row ${isSelected ? 'selected' : ''}`}
                  style={{ height: rowHeight }}
                  onClick={() => onSelectCommit(commit)}
                >
                  <div style={{
                    width: treeWidth, height: rowHeight, position: 'relative', flexShrink: 0, marginRight: 8
                  }}>
                    <svg width={treeWidth} height={rowHeight} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                      {Array.from({ length: Math.min(treeData.maxCols, 6) }).map((_, c) => {
                        if (c === treeRow.col) return null
                        return (
                          <line
                            key={c}
                            x1={c * colWidth + colWidth / 2}
                            y1={0}
                            x2={c * colWidth + colWidth / 2}
                            y2={rowHeight}
                            stroke={COLORS[c % COLORS.length]}
                            strokeWidth={2}
                            opacity={0.3}
                          />
                        )
                      })}
                      <circle
                        cx={treeRow.col * colWidth + colWidth / 2}
                        cy={rowHeight / 2}
                        r={5}
                        fill={isSelected ? 'white' : COLORS[treeRow.col % COLORS.length]}
                        stroke={COLORS[treeRow.col % COLORS.length]}
                        strokeWidth={2}
                      />
                    </svg>
                  </div>
                  <div style={{
                    minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10, paddingRight: 12
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
                      width: 70, flexShrink: 0
                    }}>
                      {commit.shortHash}
                    </div>
                    <div style={{
                      flex: 1, minWidth: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                      fontSize: 12.5, color: 'var(--text-primary)', fontWeight: isSelected ? 600 : 400
                    }}>
                      {commit.branches.filter(b => b.includes('HEAD ->') || !b.includes('HEAD')).map((b, i) => (
                        <span key={i} className={`badge ${b.startsWith('*') || b.includes('HEAD') ? 'badge-current' : 'badge-branch'}`} style={{ marginRight: 4 }}>
                          {b.replace('HEAD -> ', '').replace(/^\*\s*/, '')}
                        </span>
                      ))}
                      {commit.message.split('\n')[0]}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap', width: 100, textAlign: 'right'
                    }}>
                      {commit.author_name}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', width: 140, textAlign: 'right'
                    }}>
                      {new Date(commit.date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredCommits.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-desc">没有找到匹配的提交</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ width: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        {selectedCommit ? (
          <>
            <div style={{
              padding: 16, background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
                {selectedCommit.message.split('\n')[0]}
              </div>
              {selectedCommit.body && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {selectedCommit.body.trim()}
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span title={selectedCommit.hash}>🔑 {selectedCommit.shortHash}</span>
                <span>👤 {selectedCommit.author_name}</span>
                <span>📧 {selectedCommit.author_email}</span>
                <span>🕐 {new Date(selectedCommit.date).toLocaleString('zh-CN')}</span>
              </div>
            </div>

            <div className="panel" style={{ border: 'none', borderRadius: 0, flex: 1, minHeight: 0 }}>
              <div className="panel-header">
                <span>📂 改动文件 ({files.length})</span>
                {selectedFile && (
                  <button className="btn btn-secondary btn-icon" onClick={() => {
                    setSelectedFile(null)
                    loadCommitData(selectedCommit.hash)
                  }}>
                    ← 返回全部
                  </button>
                )}
              </div>
              <div className="panel-body" style={{ maxHeight: 180, flex: '0 0 auto' }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className={`file-tree-item ${selectedFile === f.path ? 'selected' : ''}`}
                    style={{ padding: '4px 14px', gap: 8 }}
                    onClick={() => loadFileDiff(f.path, selectedCommit.hash)}
                  >
                    <span className={`status-dot status-${f.status === 'modified' ? 'modified' : f.status === 'added' ? 'added' : f.status === 'deleted' ? 'deleted' : f.status === 'renamed' ? 'renamed' : 'conflict'}`} />
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {f.oldPath ? `${f.oldPath} → ` : ''}{f.path}
                    </span>
                    <span style={{
                      fontSize: 10, textTransform: 'uppercase', fontWeight: 600,
                      color: f.status === 'added' ? 'var(--accent-green)' :
                        f.status === 'deleted' ? 'var(--accent-red)' :
                          f.status === 'renamed' ? 'var(--accent-orange)' : 'var(--accent-blue)'
                    }}>
                      {f.status === 'modified' ? 'M' : f.status === 'added' ? 'A' : f.status === 'deleted' ? 'D' : f.status === 'renamed' ? 'R' : f.status.toUpperCase()}
                    </span>
                  </div>
                ))}
                {files.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                    没有改动文件
                  </div>
                )}
              </div>
            </div>

            <div style={{
              flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              borderTop: '1px solid var(--border-color)', minHeight: 0
            }}>
              <div className="panel-header">
                <span>🔍 Diff {selectedFile ? `- ${selectedFile}` : ''}</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DiffViewer diff={diff} />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-state-icon">👆</div>
            <div className="empty-state-title">选择一个提交</div>
            <div className="empty-state-desc">点击左侧提交历史中的任意节点，查看改动文件列表和详细 diff 内容</div>
          </div>
        )}
      </div>
    </div>
  )
}
