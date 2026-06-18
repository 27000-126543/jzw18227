import { useState, useEffect } from 'react'

interface Props {
  repoPath: string
  onClose: () => void
  onRefresh: () => void
}

interface Stash {
  index: number
  name: string
  message: string
  date: string
  branch: string
  diff?: string
}

export default function StashManager({ repoPath, onClose, onRefresh }: Props) {
  const [stashes, setStashes] = useState<Stash[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [diff, setDiff] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const list = await window.gitApi.stashList(repoPath)
      setStashes(list)
      setSelectedIdx(null)
      setDiff('')
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [repoPath])

  const handleStashPush = async () => {
    try {
      setLoading(true)
      await window.gitApi.stashPush(repoPath, message || undefined, includeUntracked)
      setMessage('')
      onRefresh()
      await load()
    } catch (e: any) {
      alert('Stash 失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleView = async (idx: number) => {
    try {
      setSelectedIdx(idx)
      const d = await window.gitApi.getDiff(repoPath, `stash@{${idx}}`, false)
      if (d) {
        setDiff(d)
      } else {
        const raw = await window.gitApi.getCommitDiff(repoPath, `stash@{${idx}}`)
        setDiff(raw)
      }
    } catch (e: any) {
      setDiff('无法查看此 stash: ' + e.message)
    }
  }

  const handleApply = async (idx: number) => {
    if (!confirm(`确认应用 stash@{${idx}}?`)) return
    try {
      setLoading(true)
      await window.gitApi.stashApply(repoPath, idx)
      onRefresh()
      await load()
      setSelectedIdx(null)
      setDiff('')
      alert('✓ 已应用')
    } catch (e: any) {
      alert('应用失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const handlePop = async (idx: number) => {
    if (!confirm(`确认弹出 stash@{${idx}}? (应用后会删除该 stash)`)) return
    try {
      setLoading(true)
      await window.gitApi.stashPop(repoPath, idx)
      onRefresh()
      await load()
      setSelectedIdx(null)
      setDiff('')
      alert('✓ 已弹出并删除')
    } catch (e: any) {
      alert('Pop 失败: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleDrop = async (idx: number) => {
    if (!confirm(`确认删除 stash@{${idx}}? 此操作不可恢复。`)) return
    try {
      setLoading(true)
      await window.gitApi.stashDrop(repoPath, idx)
      await load()
      setSelectedIdx(null)
      setDiff('')
    } catch (e: any) {
      alert('删除失败: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '85vw', height: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>📦 Stash 管理 (工作区快照)</span>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', padding: 0, gap: 0 }}>
          <div style={{ width: 360, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                ➕ 创建新 Stash
              </div>
              <div className="form-group">
                <label className="form-label">备注说明 (可选)</label>
                <input
                  type="text"
                  placeholder="例如: 临时保存 feature 进度"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  id="inc-untracked"
                  checked={includeUntracked}
                  onChange={e => setIncludeUntracked(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="inc-untracked" style={{ fontSize: 12 }}>包含未追踪文件</label>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleStashPush}
                disabled={loading}
              >
                📦 Stash 当前工作区
              </button>
            </div>

            <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              📋 快照列表 ({stashes.length})
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading && stashes.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>加载中...</div>
              ) : stashes.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  暂无 Stash 快照<br /><br />
                  当你有未提交的改动但需要切换分支时，<br />可以将当前工作区临时保存为 Stash
                </div>
              ) : (
                stashes.map(s => (
                  <div
                    key={s.index}
                    className={`file-tree-item ${selectedIdx === s.index ? 'selected' : ''}`}
                    style={{ padding: 10, gap: 10, borderBottom: '1px solid var(--border-color)' }}
                    onClick={() => handleView(s.index)}
                  >
                    <div style={{ fontSize: 18 }}>📦</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        stash@{s.index}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {s.message.split('\n')[0] || '(无备注)'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                        {new Date(s.date).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} onClick={e => e.stopPropagation()}>
                      <button className="btn-icon" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handleApply(s.index)} title="应用 (保留)">
                        应用
                      </button>
                      <button className="btn-icon" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handlePop(s.index)} title="弹出 (应用并删除)">
                        弹出
                      </button>
                      <button className="btn-icon" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--accent-red)' }} onClick={() => handleDrop(s.index)} title="删除">
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="panel-header" style={{ borderRadius: 0, border: 'none' }}>
              {selectedIdx !== null ? (
                <span>🔍 stash@{selectedIdx} 变更详情</span>
              ) : (
                <span>🔍 快照详情</span>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
              {diff ? (
                <pre style={{
                  margin: 0, padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12,
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
{diff}
                </pre>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">👈</div>
                  <div className="empty-state-title">选择一个快照</div>
                  <div className="empty-state-desc">
                    点击左侧列表中的 Stash 查看其变更内容。<br />
                    <strong>应用</strong>：将快照还原到工作区并保留此快照<br />
                    <strong>弹出</strong>：将快照还原到工作区并删除此快照<br />
                    <strong>删除</strong>：永久丢弃此快照
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
