import { useState, useEffect } from 'react'
import { BranchInfo, StashItem, GitStatus } from '../types/git'

interface Props {
  branches: BranchInfo[]
  currentBranch: string
  stashes: StashItem[]
  status: GitStatus | null
  conflicts: string[]
  onCheckout: (branch: string) => Promise<void>
  onSelectStash: () => void
  onViewRemotes: () => void
  repoPath: string
  onRefresh: () => void
}

export default function Sidebar({
  branches, currentBranch, stashes, status, conflicts,
  onCheckout, onSelectStash, onViewRemotes, repoPath, onRefresh
}: Props) {
  const [branchFilter, setBranchFilter] = useState('')

  useEffect(() => {
    setBranchFilter('')
  }, [repoPath])

  const filteredBranches = branches
    .filter(b => !branchFilter || b.name.toLowerCase().includes(branchFilter.toLowerCase()))
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div style={{
      width: 260, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
      flexShrink: 0, overflow: 'hidden'
    }}>
      {conflicts.length > 0 && (
        <div style={{
          padding: '10px 14px', background: 'rgba(210, 170, 0, 0.15)',
          borderBottom: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)',
          fontSize: 12
        }}>
          ⚠️ {conflicts.length} 个合并冲突待解决
        </div>
      )}

      <div className="section-group" style={{ flex: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="section-group-title">
          <span>🌿 本地分支 ({branches.length})</span>
        </div>
        <div style={{ padding: '6px 10px' }}>
          <input
            type="text"
            placeholder="搜索分支..."
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', maxHeight: 280 }}>
          {filteredBranches.map(b => (
            <div
              key={b.name}
              className={`file-tree-item ${b.current ? 'selected' : ''}`}
              style={{ padding: '5px 14px' }}
              onDoubleClick={() => !b.current && onCheckout(b.name)}
              title={b.current ? '当前分支' : `双击切换到 ${b.name}`}
            >
              {b.current ? (
                <span style={{ color: 'var(--accent-blue)', fontSize: 14, marginRight: 2 }}>●</span>
              ) : (
                <span style={{ width: 16, display: 'inline-block', opacity: 0.5, fontSize: 12 }}>○</span>
              )}
              <span style={{ fontSize: 12, color: b.current ? 'white' : 'var(--text-primary)' }}>
                {b.name}
              </span>
              {b.current && <span className="badge badge-current" style={{ marginLeft: 'auto' }}>当前</span>}
            </div>
          ))}
          {filteredBranches.length === 0 && (
            <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
              没有匹配的分支
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="section-group-title">
          <span>📦 暂存快照 ({stashes.length})</span>
          <button className="btn-icon" onClick={onSelectStash} title="管理 Stash">
            →
          </button>
        </div>
        <div style={{ maxHeight: 160, overflow: 'auto' }}>
          {stashes.length === 0 ? (
            <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
              暂无 Stash
            </div>
          ) : (
            stashes.slice(0, 6).map(s => (
              <div key={s.index} className="file-tree-item" style={{ padding: '5px 14px' }}>
                <span style={{ fontSize: 13 }}>📦</span>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    stash@{s.index}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {s.message.split('\n')[0] || '(no message)'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
        <div className="section-group-title">
          <span>📡 远端操作</span>
          <button className="btn-icon" onClick={onViewRemotes} title="管理远端">→</button>
        </div>
        <div style={{ padding: 10, display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center', padding: '6px' }}
            onClick={async () => {
              try {
                const result = await window.gitApi.pull(repoPath)
                if (result.success) {
                  onRefresh()
                  alert('拉取成功 ✓')
                } else {
                  alert('拉取失败: ' + (result.error || 'Unknown error'))
                }
              } catch (e: any) {
                alert('拉取失败: ' + e.message)
              }
            }}
          >
            ⬇️ 拉取
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', padding: '6px' }}
            onClick={async () => {
              try {
                const result = await window.gitApi.push(repoPath)
                if (result.success) {
                  onRefresh()
                  alert('推送成功 ✓')
                } else {
                  alert('推送失败: ' + (result.error || 'Unknown error'))
                }
              } catch (e: any) {
                alert('推送失败: ' + e.message)
              }
            }}
          >
            ⬆️ 推送
          </button>
        </div>
      </div>
    </div>
  )
}
