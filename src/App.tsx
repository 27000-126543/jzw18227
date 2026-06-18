import { useState, useEffect, useCallback, useMemo } from 'react'
import WelcomeScreen from './components/WelcomeScreen'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CommitHistory from './components/CommitHistory'
import ChangesPanel from './components/ChangesPanel'
import BranchManager from './components/BranchManager'
import ConflictResolver from './components/ConflictResolver'
import StashManager from './components/StashManager'
import RemotesManager from './components/RemotesManager'
import { Commit, GitStatus, BranchInfo, StashItem, TabKey, ViewPanel } from './types/git'

export default function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [commits, setCommits] = useState<Commit[]>([])
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('history')
  const [stashes, setStashes] = useState<StashItem[]>([])
  const [conflicts, setConflicts] = useState<string[]>([])
  const [showConflictResolver, setShowConflictResolver] = useState(false)
  const [viewPanel, setViewPanel] = useState<ViewPanel>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRepositoryData = useCallback(async () => {
    if (!repoPath) return
    setLoading(true)
    setError(null)
    try {
      const [log, branch, statusResult, branchesResult, stashesResult, conflictsResult] = await Promise.all([
        window.gitApi.getLog(repoPath, { maxCount: 300 }),
        window.gitApi.getCurrentBranch(repoPath),
        window.gitApi.getStatus(repoPath),
        window.gitApi.getBranches(repoPath),
        window.gitApi.stashList(repoPath),
        window.gitApi.getConflicts(repoPath)
      ])
      const enrichedCommits = enrichCommitsWithTree(log)
      setCommits(enrichedCommits)
      setCurrentBranch(branch)
      setStatus(statusResult)
      setBranches(branchesResult.branches || [])
      setStashes(stashesResult)
      setConflicts(conflictsResult)
      setShowConflictResolver(conflictsResult.length > 0)
    } catch (e: any) {
      setError(e.message || '加载仓库数据失败')
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  function enrichCommitsWithTree(commits: Commit[]): Commit[] {
    const hashToIndex = new Map<string, number>()
    commits.forEach((c, i) => hashToIndex.set(c.hash, i))

    const result: Commit[] = commits.map(c => ({ ...c, parents: [] }))
    const colors = ['#0078d4', '#107c10', '#d13438', '#d83b01', '#5c2d91', '#e3008c', '#00b7c3', '#f2c744']
    const branchCounters: number[] = []
    const activeBranches: (number | null)[] = []

    for (let i = 0; i < result.length; i++) {
      const commit = result[i]
      let level = activeBranches.findIndex(l => l === i)
      if (level === -1) {
        level = activeBranches.findIndex(l => l === null)
        if (level === -1) {
          level = activeBranches.length
          activeBranches.push(null)
          branchCounters.push(0)
        }
      }
      commit.treeLevel = level
      activeBranches[level] = null
    }

    return result
  }

  useEffect(() => {
    if (repoPath) {
      loadRepositoryData()
    }
  }, [repoPath, loadRepositoryData])

  const handleOpenRepo = async () => {
    const path = await window.dialogApi.openDirectory()
    if (path) {
      const isRepo = await window.gitApi.isGitRepository(path)
      if (isRepo) {
        setRepoPath(path)
        setSelectedCommit(null)
      } else {
        alert('所选目录不是有效的Git仓库')
      }
    }
  }

  const refresh = () => loadRepositoryData()

  if (!repoPath) {
    return <WelcomeScreen onOpen={handleOpenRepo} />
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        repoPath={repoPath}
        currentBranch={currentBranch}
        status={status}
        onRefresh={refresh}
        loading={loading}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          branches={branches}
          currentBranch={currentBranch}
          stashes={stashes}
          status={status}
          conflicts={conflicts}
          onCheckout={async (branch) => {
            await window.gitApi.checkout(repoPath!, branch)
            refresh()
          }}
          onSelectStash={() => setViewPanel('stash')}
          onViewRemotes={() => setViewPanel('remotes')}
          repoPath={repoPath}
          onRefresh={refresh}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div className="tabs" style={{ flexShrink: 0 }}>
            <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              📜 提交历史
            </div>
            <div className={`tab ${activeTab === 'changes' ? 'active' : ''}`} onClick={() => setActiveTab('changes')}>
              📝 暂存区/改动
              {status && !status.isClean && (
                <span style={{ marginLeft: 8, background: 'var(--accent-red)', color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>
                  {status.files.length}
                </span>
              )}
            </div>
            <div className={`tab ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>
              🌿 分支管理
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {activeTab === 'history' && (
              <CommitHistory
                commits={commits}
                selectedCommit={selectedCommit}
                onSelectCommit={setSelectedCommit}
                repoPath={repoPath}
              />
            )}
            {activeTab === 'changes' && repoPath && (
              <ChangesPanel
                repoPath={repoPath}
                status={status}
                onRefresh={refresh}
                onConflicts={setConflicts}
              />
            )}
            {activeTab === 'branches' && repoPath && (
              <BranchManager
                repoPath={repoPath}
                branches={branches}
                currentBranch={currentBranch}
                onRefresh={refresh}
                onConflicts={(c) => {
                  setConflicts(c)
                  if (c.length > 0) setShowConflictResolver(true)
                }}
              />
            )}
          </div>
        </div>
      </div>
      {showConflictResolver && repoPath && (
        <ConflictResolver
          repoPath={repoPath}
          conflicts={conflicts}
          onClose={() => {
            setShowConflictResolver(false)
            refresh()
          }}
          onRefreshConflictList={async () => {
            const c = await window.gitApi.getConflicts(repoPath)
            setConflicts(c)
            return c
          }}
        />
      )}
      {viewPanel === 'stash' && repoPath && (
        <StashManager
          repoPath={repoPath}
          onClose={() => setViewPanel('none')}
          onRefresh={refresh}
        />
      )}
      {viewPanel === 'remotes' && repoPath && (
        <RemotesManager
          repoPath={repoPath}
          onClose={() => setViewPanel('none')}
          onRefresh={refresh}
        />
      )}
      {error && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, background: 'var(--accent-red)',
          color: 'white', padding: '10px 16px', borderRadius: 4, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 14, color: 'white', fontWeight: 'bold' }}>×</button>
        </div>
      )}
    </div>
  )
}
