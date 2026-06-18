import { GitStatus } from '../types/git'

interface Props {
  repoPath: string
  currentBranch: string
  status: GitStatus | null
  onRefresh: () => void
  loading: boolean
  onSwitchRepo: (path: string) => void
}

export default function Header({ repoPath, currentBranch, status, onRefresh, loading, onSwitchRepo }: Props) {
  const handleOpenNew = async () => {
    const dir = await window.dialogApi.openDirectory()
    if (dir) {
      const isRepo = await window.gitApi.isGitRepository(dir)
      if (isRepo) {
        onSwitchRepo(dir)
      } else {
        alert('所选目录不是有效的Git仓库')
      }
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)', flexShrink: 0, minHeight: 48
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 20 }}>🌿</div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            📁 {repoPath.split(/[\\/]/).pop() || repoPath}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {repoPath}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          background: 'var(--accent-purple)', color: 'white', borderRadius: 14, fontSize: 12,
          fontWeight: 500, flexShrink: 0
        }}>
          🌿 {currentBranch || 'HEAD detached'}
        </div>
        {status && (
          <>
            {status.ahead > 0 && (
              <div style={{ fontSize: 11, color: 'var(--accent-green)', flexShrink: 0 }}>↑{status.ahead}</div>
            )}
            {status.behind > 0 && (
              <div style={{ fontSize: 11, color: 'var(--accent-orange)', flexShrink: 0 }}>↓{status.behind}</div>
            )}
            {!status.isClean && (
              <div style={{ fontSize: 11, color: 'var(--accent-yellow)', flexShrink: 0 }}>
                ● {status.files.length} changes
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? '⏳' : '🔄'} 刷新
        </button>
        <button className="btn btn-secondary" onClick={handleOpenNew}>
          📂 切换仓库
        </button>
      </div>
    </div>
  )
}
