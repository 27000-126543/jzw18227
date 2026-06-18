import { useState, useEffect, useCallback } from 'react'
import { GitStatus, StatusFile } from '../types/git'
import DiffViewer from './DiffViewer'

interface Props {
  repoPath: string
  status: GitStatus | null
  onRefresh: () => void
  onConflicts: (conflicts: string[]) => void
}

interface ParsedFileStatus {
  staged: StatusFile[]
  unstaged: StatusFile[]
  untracked: StatusFile[]
}

function parseStatus(status: GitStatus): ParsedFileStatus {
  const result: ParsedFileStatus = { staged: [], unstaged: [], untracked: [] }
  for (const f of status.files) {
    const idx = f.index || ' '
    const wd = f.working_dir || ' '
    if (idx !== ' ' && idx !== '?') {
      let s: StatusFile['status'] = 'staged_modified'
      if (idx === 'A') s = 'staged_added'
      else if (idx === 'M') s = 'staged_modified'
      else if (idx === 'D') s = 'staged_deleted'
      else if (idx === 'R') s = 'renamed'
      else if (idx === 'U') s = 'conflict'
      result.staged.push({ path: f.path, status: s, stage: 'staged' })
    }
    if (wd === '?') {
      result.untracked.push({ path: f.path, status: 'untracked', stage: 'unstaged' })
    } else if (wd !== ' ' && wd !== '?') {
      let s: StatusFile['status'] = 'modified'
      if (wd === 'M') s = 'modified'
      else if (wd === 'D') s = 'deleted'
      else if (wd === 'A') s = 'modified'
      else if (wd === 'U') s = 'conflict'
      result.unstaged.push({ path: f.path, status: s, stage: 'unstaged' })
    }
  }
  return result
}

function statusLabel(s: StatusFile['status']): { label: string; color: string; dot: string } {
  switch (s) {
    case 'untracked': return { label: '?', color: 'var(--text-muted)', dot: 'status-untracked' }
    case 'modified': return { label: 'M', color: 'var(--accent-blue)', dot: 'status-modified' }
    case 'deleted': return { label: 'D', color: 'var(--accent-red)', dot: 'status-deleted' }
    case 'staged_added': return { label: 'A', color: 'var(--accent-green)', dot: 'status-added' }
    case 'staged_modified': return { label: 'M', color: 'var(--accent-green)', dot: 'status-modified' }
    case 'staged_deleted': return { label: 'D', color: 'var(--accent-green)', dot: 'status-deleted' }
    case 'renamed': return { label: 'R', color: 'var(--accent-orange)', dot: 'status-renamed' }
    case 'conflict': return { label: '!', color: 'var(--accent-yellow)', dot: 'status-conflict' }
  }
}

export default function ChangesPanel({ repoPath, status, onRefresh, onConflicts }: Props) {
  const [commitMessage, setCommitMessage] = useState('')
  const [parsed, setParsed] = useState<ParsedFileStatus>({ staged: [], unstaged: [], untracked: [] })
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null)
  const [diff, setDiff] = useState('')
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status) {
      setParsed(parseStatus(status))
    }
  }, [status])

  const loadDiff = useCallback(async (path: string, staged: boolean) => {
    try {
      if (!staged && parsed.untracked.some(f => f.path === path)) {
        const content = await window.gitApi.readFile(repoPath, path)
        const fakeDiff = `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${content.split('\n').length} @@\n` +
          content.split('\n').map(l => '+' + l).join('\n')
        setDiff(fakeDiff)
      } else {
        const d = await window.gitApi.getDiff(repoPath, path, staged)
        setDiff(d)
      }
      setSelectedLines(new Set())
    } catch (e: any) {
      setDiff('')
    }
  }, [repoPath, parsed.untracked])

  useEffect(() => {
    if (selectedFile) {
      loadDiff(selectedFile.path, selectedFile.staged)
    } else {
      setDiff('')
    }
  }, [selectedFile, loadDiff])

  const selectAllOfType = (type: 'staged' | 'unstaged' | 'untracked') => {
    if (!status) return
    const files = (parsed[type] as StatusFile[]).map(f => f.path)
    if (files.length === 0) return
    if (type === 'untracked') {
      const first = files[0]
      setSelectedFile({ path: first, staged: false })
    } else {
      const first = files[0]
      setSelectedFile({ path: first, staged: type === 'staged' })
    }
  }

  const handleStageFile = async (path: string) => {
    try {
      setLoading(true)
      await window.gitApi.add(repoPath, [path])
      onRefresh()
    } finally { setLoading(false) }
  }

  const handleUnstageFile = async (path: string) => {
    try {
      setLoading(true)
      await window.gitApi.reset(repoPath, [path])
      onRefresh()
    } finally { setLoading(false) }
  }

  const handleStageAllUnstaged = async () => {
    const files = [...parsed.unstaged, ...parsed.untracked].map(f => f.path)
    if (files.length === 0) return
    try {
      setLoading(true)
      await window.gitApi.add(repoPath, files)
      onRefresh()
    } finally { setLoading(false) }
  }

  const handleUnstageAll = async () => {
    if (parsed.staged.length === 0) return
    try {
      setLoading(true)
      await window.gitApi.reset(repoPath)
      onRefresh()
    } finally { setLoading(false) }
  }

  const buildPatchFromSelectedLines = (diffText: string, selected: Set<string>, reverse: boolean): string | null => {
    if (selected.size === 0) return null
    const lines = diffText.split('\n')
    let hunkIdx = -1
    let lineInHunk = -1
    const resultLines: string[] = []
    let i = 0
    while (i < lines.length && (lines[i].startsWith('diff --git') || lines[i].startsWith('index') || lines[i].startsWith('---') || lines[i].startsWith('+++'))) {
      resultLines.push(lines[i])
      i++
    }
    let selectedCount = 0
    let hunkStart = i
    while (i < lines.length) {
      if (lines[i].startsWith('@@')) {
        if (selectedCount > 0) {
          // push previous hunk (already added)
        }
        hunkIdx++
        lineInHunk = -1
        selectedCount = 0
        // find all selected in this hunk first
        let j = i + 1
        let hunkLines: string[] = [lines[i]]
        let tempLineInHunk = -1
        let tempSelectedCount = 0
        while (j < lines.length && !lines[j].startsWith('@@')) {
          tempLineInHunk++
          const key = `${hunkIdx}-${tempLineInHunk}`
          const isAdd = lines[j].startsWith('+') && !lines[j].startsWith('+++')
          const isDel = lines[j].startsWith('-') && !lines[j].startsWith('---')
          if ((isAdd || isDel) && selected.has(key)) {
            tempSelectedCount++
          }
          hunkLines.push(lines[j])
          j++
        }
        if (tempSelectedCount > 0) {
          // rebuild hunk: include context + selected changes
          const headerLine = lines[i]
          resultLines.push(headerLine)
          for (let k = 1; k < hunkLines.length; k++) {
            const line = hunkLines[k]
            const key = `${hunkIdx}-${k - 1}`
            const isAdd = line.startsWith('+') && !line.startsWith('+++')
            const isDel = line.startsWith('-') && !line.startsWith('---')
            if (isAdd || isDel) {
              if (selected.has(key)) {
                resultLines.push(line)
              } else {
                // treat as context
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  resultLines.push(' ' + line.slice(1))
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  resultLines.push(' ' + line.slice(1))
                } else {
                  resultLines.push(line)
                }
              }
            } else {
              resultLines.push(line)
            }
          }
        }
        i = j
      } else {
        i++
      }
    }
    if (resultLines.length === 0) return null
    return resultLines.join('\n') + '\n'
  }

  const handleStageSelectedLines = async () => {
    if (!selectedFile || selectedLines.size === 0) return
    const patch = buildPatchFromSelectedLines(diff, selectedLines, false)
    if (!patch) return
    try {
      setLoading(true)
      await window.gitApi.addPatch(repoPath, selectedFile.path, patch)
      setSelectedLines(new Set())
      onRefresh()
    } catch (e: any) {
      alert('逐行暂存失败，已回退到整文件暂存: ' + e.message)
      await handleStageFile(selectedFile.path)
    } finally { setLoading(false) }
  }

  const handleUnstageSelectedLines = async () => {
    if (!selectedFile || selectedLines.size === 0) return
    const patch = buildPatchFromSelectedLines(diff, selectedLines, true)
    if (!patch) return
    try {
      setLoading(true)
      await window.gitApi.resetPatch(repoPath, selectedFile.path, patch)
      setSelectedLines(new Set())
      onRefresh()
    } catch (e: any) {
      alert('逐行取消暂存失败，已回退到整文件操作: ' + e.message)
      await handleUnstageFile(selectedFile.path)
    } finally { setLoading(false) }
  }

  const handleToggleLine = (key: string) => {
    const newSet = new Set(selectedLines)
    if (newSet.has(key)) newSet.delete(key)
    else newSet.add(key)
    setSelectedLines(newSet)
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert('请填写提交信息')
      return
    }
    if (parsed.staged.length === 0) {
      alert('暂存区为空，请先暂存需要提交的改动')
      return
    }
    try {
      setLoading(true)
      const result = await window.gitApi.commit(repoPath, commitMessage)
      if (result.success) {
        setCommitMessage('')
        setSelectedFile(null)
        onRefresh()
        alert(`提交成功 ✓\n哈希: ${result.hash}`)
      } else {
        alert('提交失败: ' + result.error)
      }
    } catch (e: any) {
      alert('提交失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const renderFileList = (title: string, files: StatusFile[], type: 'staged' | 'unstaged' | 'untracked', headerActions?: JSX.Element) => (
    <div className="section-group" style={{ marginBottom: 0 }}>
      <div className="section-group-title">
        <span>{title} ({files.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {headerActions}
          {files.length > 0 && (
            <button className="btn-icon" onClick={() => selectAllOfType(type)} title="查看第一个文件">
              👁
            </button>
          )}
        </div>
      </div>
      {files.length === 0 ? (
        <div style={{ padding: 10, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
          无文件
        </div>
      ) : (
        files.map(f => {
          const meta = statusLabel(f.status)
          const isSelected = selectedFile?.path === f.path && selectedFile?.staged === (type === 'staged')
          return (
            <div
              key={f.path + type}
              className={`file-tree-item ${isSelected ? 'selected' : ''}`}
              style={{ padding: '4px 10px', gap: 6 }}
              onClick={() => setSelectedFile({ path: f.path, staged: type === 'staged' })}
            >
              <span className={`status-dot ${meta.dot}`} />
              <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, width: 14, textAlign: 'center' }}>
                {meta.label}
              </span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {f.path}
              </span>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                {type === 'staged' ? (
                  <button className="btn-icon" onClick={() => handleUnstageFile(f.path)} title="取消暂存">
                    ←
                  </button>
                ) : (
                  <button className="btn-icon" onClick={() => handleStageFile(f.path)} title="暂存文件">
                    →
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  if (!status) {
    return <div style={{ padding: 20, color: 'var(--text-muted)' }}>加载中...</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, borderRight: '1px solid var(--border-color)' }}>
        <div style={{
          padding: 14, background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0
        }}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">提交信息</label>
            <textarea
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              placeholder="简要描述本次提交的改动..."
              className="form-input"
              style={{ minHeight: 70 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-success"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleCommit}
              disabled={loading || parsed.staged.length === 0 || !commitMessage.trim()}
            >
              ✓ 提交到 {status.current || 'HEAD'}
            </button>
            <button className="btn btn-secondary" onClick={() => setCommitMessage('')} disabled={loading}>
              清空
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderFileList(
            '✅ 已暂存 (Staged)',
            parsed.staged,
            'staged',
            <button className="btn-icon" onClick={handleUnstageAll} title="全部取消暂存" disabled={parsed.staged.length === 0 || loading}>
              ⤺ 全部
            </button>
          )}
          {renderFileList(
            '✏️ 已修改 (Modified)',
            parsed.unstaged,
            'unstaged',
            <button className="btn-icon" onClick={handleStageAllUnstaged} title="全部暂存" disabled={(parsed.unstaged.length + parsed.untracked.length) === 0 || loading}>
              ⤼ 全部
            </button>
          )}
          {renderFileList(
            '❓ 未追踪 (Untracked)',
            parsed.untracked,
            'untracked'
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFile ? (
              <>
                📄 {selectedFile.path}
                <span className="badge" style={{ marginLeft: 10 }}>
                  {selectedFile.staged ? '已暂存 (查看 staged diff)' : '工作区 (查看 unstaged diff)'}
                </span>
              </>
            ) : '选择左侧文件查看 diff'}
          </div>
          {selectedFile && selectedLines.size > 0 && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <span className="badge">{selectedLines.size} 行选中</span>
              {selectedFile.staged ? (
                <button className="btn btn-secondary" onClick={handleUnstageSelectedLines} disabled={loading}>
                  ← 取消暂存选中行
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleStageSelectedLines} disabled={loading}>
                  → 暂存选中行
                </button>
              )}
            </div>
          )}
          {selectedFile && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              {selectedFile.staged ? (
                <button className="btn btn-secondary" onClick={() => handleUnstageFile(selectedFile.path)} disabled={loading}>
                  整文件取消暂存
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => handleStageFile(selectedFile.path)} disabled={loading}>
                  整文件暂存
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selectedFile ? (
            <DiffViewer
              diff={diff}
              fileName={selectedFile.path}
              selectable={true}
              selectedLines={selectedLines}
              onToggleLine={(k, _) => handleToggleLine(k)}
            />
          ) : (
            <div className="empty-state" style={{ height: '100%' }}>
              <div className="empty-state-icon">👈</div>
              <div className="empty-state-title">选择一个文件</div>
              <div className="empty-state-desc">
                点击左侧列表中的文件查看详细 diff。<br />
                可以点击 diff 中的变更行进行逐行暂存或取消暂存，精细控制你的提交内容。
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span className="status-dot status-modified" style={{ display: 'inline-block', marginRight: 5 }} /> 已修改
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span className="status-dot status-added" style={{ display: 'inline-block', marginRight: 5 }} /> 新增
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span className="status-dot status-deleted" style={{ display: 'inline-block', marginRight: 5 }} /> 删除
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span className="status-dot status-untracked" style={{ display: 'inline-block', marginRight: 5 }} /> 未追踪
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
