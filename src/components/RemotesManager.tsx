import { useState, useEffect } from 'react'

interface Props {
  repoPath: string
  onClose: () => void
  onRefresh: () => void
}

interface Remote {
  name: string
  refs: { fetch: string; push: string }
}

export default function RemotesManager({ repoPath, onClose, onRefresh }: Props) {
  const [remotes, setRemotes] = useState<Remote[]>([])
  const [loading, setLoading] = useState(true)
  const [opLoading, setOpLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [selectedRemote, setSelectedRemote] = useState('origin')
  const [customRemote, setCustomRemote] = useState('')
  const [customBranch, setCustomBranch] = useState('')
  const [pushBranch, setPushBranch] = useState('')
  const [forcePush, setForcePush] = useState(false)
  const [setUpstream, setSetUpstream] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const r = await window.gitApi.getRemotes(repoPath)
      setRemotes(r)
      if (r.length > 0 && !r.find(x => x.name === selectedRemote)) {
        setSelectedRemote(r[0].name)
      }
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const addLog = (msg: string) => setLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`])

  const handlePull = async () => {
    try {
      setOpLoading(true)
      const remote = customRemote || selectedRemote
      const branch = customBranch || undefined
      addLog(`⬇ 开始拉取: ${remote}${branch ? ' ' + branch : ''}`)
      const result = await window.gitApi.pull(repoPath, remote, branch)
      if (result.success) {
        addLog('✓ 拉取成功')
        onRefresh()
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          addLog(`⚠ 拉取后产生冲突 (${result.conflicts.length} 个文件)，请在冲突解决界面处理`)
        }
        addLog('拉取结果: ' + (result.error || '完成'))
        alert(result.error ? '拉取问题: ' + result.error : '拉取完成')
        onRefresh()
      }
    } catch (e: any) {
      addLog('✗ 拉取失败: ' + e.message)
      alert('拉取失败: ' + e.message)
    } finally { setOpLoading(false) }
  }

  const handlePush = async () => {
    try {
      setOpLoading(true)
      const remote = customRemote || selectedRemote
      const branch = pushBranch || undefined
      addLog(`⬆ 开始推送${forcePush ? '(强制)' : ''}${setUpstream ? '(并设置上游)' : ''}: ${remote}${branch ? ' ' + branch : ''}`)
      const result = await window.gitApi.push(repoPath, remote, branch)
      if (result.success) {
        addLog('✓ 推送成功')
        onRefresh()
      } else {
        addLog('✗ 推送失败: ' + (result.error || '未知错误'))
        alert('推送失败: ' + (result.error || 'Unknown error') + '\n\n如果是上游分支未设置，请勾选"设置上游分支"并指定远端分支名')
      }
    } catch (e: any) {
      addLog('✗ 推送异常: ' + e.message)
      alert('推送异常: ' + e.message)
    } finally { setOpLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '720px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>📡 远端仓库操作 (Pull / Push)</span>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>
        <div className="modal-body">
          <div style={{
            padding: 14, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            borderRadius: 4, marginBottom: 18
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>
              已配置的远端仓库
            </div>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>加载中...</div>
            ) : remotes.length === 0 ? (
              <div style={{ color: 'var(--accent-orange)', fontSize: 12 }}>
                ⚠️ 本仓库未配置任何远端仓库。请先使用 `git remote add` 添加，或在下方自定义地址。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {remotes.map(r => (
                  <div
                    key={r.name}
                    className={`file-tree-item ${selectedRemote === r.name ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedRemote(r.name)
                      setCustomRemote('')
                    }}
                    style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-color)' }}
                  >
                    <span style={{ fontSize: 16 }}>🌐</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {r.name}
                        {r.name === 'origin' && <span className="badge badge-current" style={{ marginLeft: 8, fontSize: 10 }}>默认</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                        Fetch: {r.refs.fetch}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Push: {r.refs.push}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="panel">
              <div className="panel-header" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                <span style={{ color: 'var(--accent-blue)' }}>⬇️ 拉取 (Pull)</span>
              </div>
              <div className="panel-body" style={{ padding: 14 }}>
                <div className="form-group">
                  <label className="form-label">远端仓库</label>
                  <select
                    value={customRemote || selectedRemote}
                    onChange={e => {
                      if (remotes.find(r => r.name === e.target.value)) {
                        setSelectedRemote(e.target.value)
                        setCustomRemote('')
                      } else {
                        setCustomRemote(e.target.value)
                      }
                    }}
                    className="form-input"
                  >
                    {remotes.map(r => (
                      <option key={r.name} value={r.name}>{r.name} ({r.refs.fetch})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">分支 (留空=当前分支对应远端)</label>
                  <input
                    type="text"
                    placeholder="例如: main"
                    value={customBranch}
                    onChange={e => setCustomBranch(e.target.value)}
                    className="form-input"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handlePull}
                  disabled={opLoading}
                >
                  ⬇️ 拉取
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                <span style={{ color: 'var(--accent-green)' }}>⬆️ 推送 (Push)</span>
              </div>
              <div className="panel-body" style={{ padding: 14 }}>
                <div className="form-group">
                  <label className="form-label">远端仓库</label>
                  <select
                    value={customRemote || selectedRemote}
                    onChange={e => {
                      if (remotes.find(r => r.name === e.target.value)) {
                        setSelectedRemote(e.target.value)
                        setCustomRemote('')
                      } else {
                        setCustomRemote(e.target.value)
                      }
                    }}
                    className="form-input"
                  >
                    {remotes.map(r => (
                      <option key={r.name} value={r.name}>{r.name} ({r.refs.push})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">推送分支 (首次推送请填写)</label>
                  <input
                    type="text"
                    placeholder="例如: feature/my-branch"
                    value={pushBranch}
                    onChange={e => setPushBranch(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <input type="checkbox" checked={setUpstream} onChange={e => setSetUpstream(e.target.checked)} />
                    设置上游 (-u)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-red)' }}>
                    <input type="checkbox" checked={forcePush} onChange={e => setForcePush(e.target.checked)} />
                    强制推送 (危险)
                  </label>
                </div>
                <button
                  className="btn btn-success"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handlePush}
                  disabled={opLoading}
                >
                  ⬆️ 推送
                </button>
              </div>
            </div>
          </div>

          {log.length > 0 && (
            <div style={{
              marginTop: 16, padding: 12, background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)', borderRadius: 4, maxHeight: 140, overflow: 'auto'
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                📋 操作日志
              </div>
              {log.slice(-10).map((l, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
