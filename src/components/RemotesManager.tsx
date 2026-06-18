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

  useEffect(() => { load() }, [repoPath])

  const addLog = (msg: string) => setLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`])

  useEffect(() => {
    setCustomRemote('')
    setCustomBranch('')
    setPushBranch('')
    setForcePush(false)
    setSetUpstream(true)
    setLog([])
  }, [repoPath])

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
      addLog(`⬆ 开始推送: ${pushCmdPreview}`)
      const result: any = await window.gitApi.push(repoPath, remote, branch, setUpstream, forcePush)
      if (result.success) {
        addLog(`✓ 推送成功 (实际执行: git push ${(result.args || []).join(' ')})`)
        onRefresh()
      } else {
        const actualArgs = (result.args || []).join(' ') || '<empty>'
        addLog(`✗ 推送失败: git push ${actualArgs} → ${result.error || '未知错误'}`)
        const hint: string[] = []
        const err = (result.error || '').toLowerCase()
        hint.push(`实际执行命令: git push ${actualArgs}`)
        hint.push('')
        if (err.includes('no upstream branch') || err.includes('no upstream') || err.includes('upstream branch')) {
          hint.push('原因: 当前分支没有设置上游分支')
          hint.push('解决: 勾选"设置上游 (-u)" 并填写远端分支名')
        } else if (err.includes('rejected') || err.includes('non-fast-forward')) {
          hint.push('原因: 本地版本落后于远端（non-fast-forward）')
          hint.push('解决: 先执行拉取合并，或勾选"强制推送"（强制会覆盖远端历史，慎用！）')
        } else if (err.includes('auth') || err.includes('permission') || err.includes('denied')) {
          hint.push('原因: 权限被拒绝或认证失败')
          hint.push('解决: 检查远端仓库 URL 是否正确、SSH 密钥或凭证是否已配置')
        } else if (err.includes('remote not found') || err.includes('does not exist')) {
          hint.push('原因: 远端仓库不存在')
          hint.push('解决: 在仓库配置中用 git remote add 添加正确的远端地址')
        } else if (err.includes('force') || err.includes('protected')) {
          hint.push('原因: 该分支是受保护分支，禁止强制推送')
          hint.push('解决: 不勾选"强制推送"，或在 Git 平台上修改分支保护规则')
        } else {
          hint.push('原因说明: ' + (result.error || '未知'))
        }
        alert('推送失败\n\n' + hint.join('\n'))
      }
    } catch (e: any) {
      addLog('✗ 推送异常: ' + e.message)
      alert('推送异常:\n\n' + e.message)
    } finally { setOpLoading(false) }
  }

  const handleFetch = async (all = false, prune = false) => {
    try {
      setOpLoading(true)
      const remote = customRemote || selectedRemote
      const cmd = all
        ? `git fetch --all${prune ? ' --prune' : ''}`
        : `git fetch ${remote}${prune ? ' --prune' : ''}`
      addLog(`🔄 开始执行: $ ${cmd}`)
      const result = all
        ? await window.gitApi.fetchAll(repoPath, prune)
        : await window.gitApi.fetch(repoPath, remote, prune)
      if (result.success) {
        addLog(`✓ ${result.message || '完成'}`)
        onRefresh()
        load()
      } else {
        addLog(`✗ 失败: ${result.error || '未知错误'}`)
        alert('失败: ' + (result.error || '未知错误'))
      }
    } catch (e: any) {
      addLog('✗ 异常: ' + e.message)
      alert('异常: ' + e.message)
    } finally { setOpLoading(false) }
  }

  const handlePrune = async () => {
    try {
      setOpLoading(true)
      const remote = customRemote || selectedRemote
      addLog(`🧹 清理远端已删除引用: $ git remote prune ${remote}`)
      const result = await window.gitApi.remotePrune(repoPath, remote)
      if (result.success) {
        addLog(`✓ ${result.message || '完成'}`)
        onRefresh()
        load()
      } else {
        addLog(`✗ 失败: ${result.error || '未知错误'}`)
        alert('失败: ' + (result.error || '未知错误'))
      }
    } catch (e: any) {
      addLog('✗ 异常: ' + e.message)
      alert('异常: ' + e.message)
    } finally { setOpLoading(false) }
  }

  const buildPushArgs = (): string[] => {
    const args: string[] = []
    if (forcePush) args.push('--force')
    const remote = customRemote || selectedRemote
    if (setUpstream && remote && pushBranch) {
      args.push('-u', remote, pushBranch)
    } else if (remote && pushBranch) {
      args.push(remote, pushBranch)
    }
    return args
  }

  const pushCmdPreview = (() => {
    const parts = ['git push', ...buildPushArgs()]
    return parts.join(' ')
  })()

  const pullCmdPreview = (() => {
    const remote = customRemote || selectedRemote
    const parts = ['git pull']
    if (customBranch) {
      parts.push(remote, customBranch)
    }
    return parts.join(' ')
  })()

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
                <div style={{
                  marginTop: 10, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: '#0d0d0d', color: 'var(--accent-blue)', borderRadius: 4, border: '1px solid var(--border-color)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }} title={pullCmdPreview}>
                  $ {pullCmdPreview}
                </div>
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
                <div style={{
                  marginTop: 10, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: '#0d0d0d', color: forcePush ? 'var(--accent-red)' : 'var(--accent-green)',
                  borderRadius: 4, border: '1px solid var(--border-color)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontWeight: forcePush ? 700 : 400
                }} title={pushCmdPreview}>
                  $ {pushCmdPreview}
                  {!pushBranch && (
                    <span style={{ marginLeft: 8, color: 'var(--accent-orange)', fontWeight: 600 }}>
                      ⚠ 未填分支将推到默认上游
                    </span>
                  )}
                  {forcePush && (
                    <span style={{ marginLeft: 8, fontWeight: 700 }}>
                      ⚠ 强制推送将覆盖远端历史!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              <span style={{ color: 'var(--text-secondary)' }}>🔧 维护操作 (Fetch / Prune)</span>
            </div>
            <div className="panel-body" style={{ padding: 14 }}>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12
              }}>
                Fetch 只从远端下载最新引用但不合并，保持本地分支不变；Prune 清理本地已被远端删除的追踪分支引用。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => handleFetch(false, false)} disabled={opLoading}>
                  🔄 Fetch 单远端
                </button>
                <button className="btn btn-secondary" onClick={() => handleFetch(false, true)} disabled={opLoading}>
                  🔄 Fetch + Prune
                </button>
                <button className="btn btn-secondary" onClick={() => handleFetch(true, false)} disabled={opLoading}>
                  🔄 Fetch 全部 (--all)
                </button>
                <button className="btn btn-secondary" onClick={() => handleFetch(true, true)} disabled={opLoading}>
                  🔄 Fetch 全部 + Prune
                </button>
                <button className="btn btn-warning" onClick={handlePrune} disabled={opLoading} style={{ gridColumn: 'span 2' }}>
                  🧹 清理远程已删除引用 (git remote prune)
                </button>
                <div style={{
                  gridColumn: 'span 2', padding: '8px 10px', background: '#0d0d0d',
                  border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 10.5,
                  color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.8
                }}>
                  当前远端：<span style={{ color: 'var(--text-primary)' }}>{customRemote || selectedRemote}</span><br />
                  已配置远端数：<span style={{ color: 'var(--text-primary)' }}>{remotes.length}</span>
                </div>
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
