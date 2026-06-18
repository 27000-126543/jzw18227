import { useState } from 'react'
import { BranchInfo } from '../types/git'

type ActionMode = 'create' | 'merge' | 'rebase' | 'delete' | null

interface Props {
  repoPath: string
  branches: BranchInfo[]
  currentBranch: string
  onRefresh: () => void
  onConflicts: (conflicts: string[]) => void
}

export default function BranchManager({ repoPath, branches, currentBranch, onRefresh, onConflicts }: Props) {
  const [mode, setMode] = useState<ActionMode>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [targetBranch, setTargetBranch] = useState<string>('')
  const [newBranchName, setNewBranchName] = useState('')
  const [fromBranch, setFromBranch] = useState<string>(currentBranch || '')
  const [deleteForce, setDeleteForce] = useState(false)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`])

  const resetForm = () => {
    setMode(null)
    setNewBranchName('')
    setTargetBranch('')
    setDeleteForce(false)
  }

  const handleCreate = async () => {
    if (!newBranchName.trim()) return alert('请输入分支名')
    try {
      setLoading(true)
      await window.gitApi.createBranch(repoPath, newBranchName.trim(), fromBranch || undefined)
      addLog(`✓ 创建分支 ${newBranchName} (基于 ${fromBranch || 'HEAD'})`)
      resetForm()
      onRefresh()
    } catch (e: any) {
      addLog(`✗ 创建失败: ${e.message}`)
      alert('创建分支失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleCheckout = async (branch: string) => {
    if (branch === currentBranch) return
    try {
      setLoading(true)
      await window.gitApi.checkout(repoPath, branch)
      addLog(`✓ 切换到分支 ${branch}`)
      onRefresh()
    } catch (e: any) {
      addLog(`✗ 切换失败: ${e.message}`)
      alert('切换分支失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selectedBranch) return alert('请选择要删除的分支')
    if (selectedBranch === currentBranch) return alert('不能删除当前所在分支')
    if (!confirm(`确认删除分支 "${selectedBranch}" ${deleteForce ? '(强制)' : ''}?`)) return
    try {
      setLoading(true)
      await window.gitApi.deleteBranch(repoPath, selectedBranch, deleteForce)
      addLog(`✓ 删除分支 ${selectedBranch}`)
      resetForm()
      setSelectedBranch('')
      onRefresh()
    } catch (e: any) {
      addLog(`✗ 删除失败: ${e.message}`)
      alert('删除分支失败: ' + e.message + '\n如分支已合并但仍报错，可勾选强制删除')
    } finally { setLoading(false) }
  }

  const handleMerge = async () => {
    if (!targetBranch) return alert('请选择要合并进来的分支')
    if (targetBranch === currentBranch) return alert('不能合并当前分支自身')
    if (!confirm(`确认将分支 "${targetBranch}" 合并到 "${currentBranch}"?`)) return
    try {
      setLoading(true)
      const result = await window.gitApi.merge(repoPath, targetBranch)
      if (result.success) {
        addLog(`✓ 合并完成: ${targetBranch} → ${currentBranch}`)
        resetForm()
        onRefresh()
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          addLog(`⚠ 产生合并冲突 (${result.conflicts.length} 个文件): ${result.conflicts.join(', ')}`)
          onConflicts(result.conflicts)
          alert(`合并产生冲突！\n\n${result.conflicts.length} 个文件需要手动解决:\n\n` + result.conflicts.map(c => '  • ' + c).join('\n'))
        } else {
          addLog(`✗ 合并失败: ${result.error}`)
          alert('合并失败: ' + result.error)
        }
      }
    } catch (e: any) {
      addLog(`✗ 合并异常: ${e.message}`)
    } finally { setLoading(false) }
  }

  const handleRebase = async () => {
    if (!targetBranch) return alert('请选择要变基到的分支')
    if (!confirm(`确认将当前分支 "${currentBranch}" 变基到 "${targetBranch}"?\n\n变基会改写提交历史，建议仅在未推送的本地分支上使用。`)) return
    try {
      setLoading(true)
      const result = await window.gitApi.rebase(repoPath, targetBranch)
      if (result.success) {
        addLog(`✓ 变基完成: ${currentBranch} → ${targetBranch}`)
        resetForm()
        onRefresh()
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          addLog(`⚠ 变基产生冲突 (${result.conflicts.length} 个文件)`)
          onConflicts(result.conflicts)
          alert(`变基产生冲突！\n\n${result.conflicts.length} 个文件需要解决。\n解决完冲突后返回此面板继续变基。`)
        } else {
          addLog(`✗ 变基失败: ${result.error}`)
          alert('变基失败: ' + result.error)
        }
      }
    } catch (e: any) {
      addLog(`✗ 变基异常: ${e.message}`)
    } finally { setLoading(false) }
  }

  const handleAbortMerge = async () => {
    try {
      await window.gitApi.abortMerge(repoPath)
      addLog('✓ 已中止合并')
      onConflicts([])
      onRefresh()
    } catch (e: any) {
      alert('中止合并失败: ' + e.message)
    }
  }

  const handleAbortRebase = async () => {
    try {
      await window.gitApi.abortRebase(repoPath)
      addLog('✓ 已中止变基')
      onConflicts([])
      onRefresh()
    } catch (e: any) {
      alert('中止变基失败: ' + e.message)
    }
  }

  const handleContinueRebase = async () => {
    try {
      setLoading(true)
      await window.gitApi.continueRebase(repoPath)
      addLog('✓ 变基继续完成')
      onConflicts([])
      resetForm()
      onRefresh()
    } catch (e: any) {
      alert('继续变基失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const sortedBranches = [...branches].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, borderRight: '1px solid var(--border-color)' }}>
        <div className="panel" style={{ border: 'none', borderRadius: 0, flex: 1 }}>
          <div className="panel-header">
            <span>🌿 本地分支 ({branches.length})</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn btn-icon ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode(mode === 'create' ? null : 'create')} title="创建分支">
                ＋
              </button>
              <button className={`btn btn-icon ${mode === 'delete' ? 'active' : ''}`} onClick={() => setMode(mode === 'delete' ? null : 'delete')} title="删除分支">
                🗑
              </button>
            </div>
          </div>
          <div className="panel-body">
            {sortedBranches.map(b => (
              <div
                key={b.name}
                className={`file-tree-item ${selectedBranch === b.name ? 'selected' : ''}`}
                style={{ padding: '6px 14px', gap: 8 }}
                onClick={() => setSelectedBranch(b.name)}
              >
                {b.current ? (
                  <span style={{ color: 'var(--accent-blue)', fontSize: 14 }}>●</span>
                ) : (
                  <span style={{ width: 14, opacity: 0.4, fontSize: 12, display: 'inline-block' }}>○</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: b.current ? 600 : 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {b.commit?.slice(0, 8) || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                  {!b.current && (
                    <button className="btn-icon" onClick={() => handleCheckout(b.name)} title={`切换到 ${b.name}`}>
                      ⇆
                    </button>
                  )}
                </div>
                {b.current && <span className="badge badge-current" style={{ flexShrink: 0 }}>当前</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)',
          display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0
        }}>
          <button className={`btn ${mode === 'merge' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode(mode === 'merge' ? null : 'merge')}>
            🔀 合并分支
          </button>
          <button className={`btn ${mode === 'rebase' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode(mode === 'rebase' ? null : 'rebase')}>
            ↪️ 变基 (Rebase)
          </button>
          <button className="btn btn-secondary" onClick={handleAbortMerge} title="放弃合并">
            ⛔ 中止合并
          </button>
          <button className="btn btn-secondary" onClick={handleAbortRebase} title="放弃变基">
            ⛔ 中止变基
          </button>
          <button className="btn btn-success" onClick={handleContinueRebase} style={{ marginLeft: 'auto' }}>
            ✓ 继续 (解决冲突后)
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {!mode && (
            <div className="empty-state">
              <div className="empty-state-icon">🌿</div>
              <div className="empty-state-title">分支管理</div>
              <div className="empty-state-desc">
                在此面板管理所有本地分支。<br /><br />
                <strong>支持的操作：</strong><br />
                🌱 创建新分支 · ⇆ 双击切换分支 · 🗑 删除分支<br />
                🔀 合并 (Merge) · ↪️ 变基 (Rebase)<br /><br />
                点击上方按钮开始操作，或在左侧双击分支名进行切换。
              </div>
            </div>
          )}

          {mode === 'create' && (
            <div className="panel" style={{ maxWidth: 500, margin: '0 auto' }}>
              <div className="panel-header">🌱 创建新分支</div>
              <div className="panel-body" style={{ padding: 20 }}>
                <div className="form-group">
                  <label className="form-label">新分支名称</label>
                  <input
                    type="text"
                    placeholder="feature/my-feature"
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">基于分支 (留空表示基于当前 HEAD)</label>
                  <select value={fromBranch} onChange={e => setFromBranch(e.target.value)} className="form-input">
                    <option value="">当前 HEAD ({currentBranch})</option>
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name} {b.current ? '(当前)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={resetForm}>取消</button>
                  <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !newBranchName.trim()}>
                    创建并切换
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'delete' && (
            <div className="panel" style={{ maxWidth: 500, margin: '0 auto' }}>
              <div className="panel-header">🗑 删除分支</div>
              <div className="panel-body" style={{ padding: 20 }}>
                <div className="form-group">
                  <label className="form-label">选择要删除的分支</label>
                  <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="form-input">
                    <option value="">请选择...</option>
                    {branches.filter(b => !b.current).map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="force-delete"
                    checked={deleteForce}
                    onChange={e => setDeleteForce(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="force-delete" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    强制删除 (即使分支未完全合并也删除)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={resetForm}>取消</button>
                  <button className="btn btn-danger" onClick={handleDelete} disabled={loading || !selectedBranch}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'merge' && (
            <div className="panel" style={{ maxWidth: 500, margin: '0 auto' }}>
              <div className="panel-header">🔀 合并分支</div>
              <div className="panel-body" style={{ padding: 20 }}>
                <div style={{
                  padding: 14, background: 'rgba(0, 120, 212, 0.08)',
                  border: '1px solid rgba(0, 120, 212, 0.3)', borderRadius: 4, marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>当前分支 (目标)</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-blue)' }}>
                    🌿 {currentBranch}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">选择要合并进来的分支</label>
                  <select value={targetBranch} onChange={e => setTargetBranch(e.target.value)} className="form-input">
                    <option value="">请选择...</option>
                    {branches.filter(b => !b.current).map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {targetBranch && (
                  <div style={{
                    padding: 14, background: 'rgba(16, 124, 16, 0.08)',
                    border: '1px solid rgba(16, 124, 16, 0.3)', borderRadius: 4, marginBottom: 16
                  }}>
                    <div style={{ textAlign: 'center', fontSize: 13 }}>
                      <strong style={{ color: 'var(--accent-green)' }}>{targetBranch}</strong>
                      <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>─── merge ──▶</span>
                      <strong style={{ color: 'var(--accent-blue)' }}>{currentBranch}</strong>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={resetForm}>取消</button>
                  <button className="btn btn-primary" onClick={handleMerge} disabled={loading || !targetBranch}>
                    开始合并
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'rebase' && (
            <div className="panel" style={{ maxWidth: 500, margin: '0 auto' }}>
              <div className="panel-header">↪️ 变基 (Rebase)</div>
              <div className="panel-body" style={{ padding: 20 }}>
                <div style={{
                  padding: 12, background: 'rgba(216, 59, 1, 0.08)',
                  border: '1px solid rgba(216, 59, 1, 0.3)', borderRadius: 4, marginBottom: 16,
                  fontSize: 12, color: 'var(--accent-orange)', lineHeight: 1.6
                }}>
                  ⚠️ <strong>警告：</strong>变基会重写提交历史。如果当前分支已经推送到远端并被其他人使用，<strong>不建议使用变基</strong>。仅在本地未推送的私有分支上使用变基以保持提交历史整洁。
                </div>
                <div style={{
                  padding: 14, background: 'rgba(92, 45, 145, 0.08)',
                  border: '1px solid rgba(92, 45, 145, 0.3)', borderRadius: 4, marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>当前分支 (将被变基)</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-purple)' }}>
                    🌿 {currentBranch}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">变基目标分支 (将当前分支"重放"到这个分支之上)</label>
                  <select value={targetBranch} onChange={e => setTargetBranch(e.target.value)} className="form-input">
                    <option value="">请选择...</option>
                    {branches.filter(b => !b.current).map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {targetBranch && (
                  <div style={{
                    padding: 14, background: 'rgba(92, 45, 145, 0.08)',
                    border: '1px solid rgba(92, 45, 145, 0.3)', borderRadius: 4, marginBottom: 16
                  }}>
                    <div style={{ textAlign: 'center', fontSize: 13 }}>
                      <strong style={{ color: 'var(--accent-purple)' }}>{currentBranch}</strong>
                      <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>── rebase onto ─▶</span>
                      <strong style={{ color: 'var(--accent-green)' }}>{targetBranch}</strong>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={resetForm}>取消</button>
                  <button className="btn btn-success" onClick={handleRebase} disabled={loading || !targetBranch}>
                    开始变基
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {log.length > 0 && (
          <div style={{
            maxHeight: 160, overflow: 'auto', borderTop: '1px solid var(--border-color)',
            padding: 10, background: 'var(--bg-primary)', flexShrink: 0
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
              📋 操作日志
            </div>
            {log.slice(-10).map((l, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
