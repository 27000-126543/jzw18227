import { ipcMain } from 'electron'
import simpleGit, { SimpleGit, StatusResult, LogResult, BranchSummary } from 'simple-git'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

async function runGitApplyCached(repoPath: string, patch: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `git-patch-${Date.now()}-${Math.random().toString(36).slice(2)}.patch`)
  try {
    fs.writeFileSync(tmpFile, patch, 'utf-8')
    const { stdout, stderr } = await execFileAsync('git', ['apply', '--cached', tmpFile], {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024
    })
    return stdout
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

const gitInstances: Map<string, SimpleGit> = new Map()

function getGit(repoPath: string): SimpleGit {
  if (!gitInstances.has(repoPath)) {
    gitInstances.set(repoPath, simpleGit(repoPath))
  }
  return gitInstances.get(repoPath)!
}

function handleError(error: any): string {
  if (error.message) {
    return error.message
  }
  return String(error)
}

export function registerGitIpcHandlers() {
  ipcMain.handle('git:openRepository', async (_, repoPath: string) => {
    try {
      const git = getGit(repoPath)
      await git.checkIsRepo()
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error) }
    }
  })

  ipcMain.handle('git:isGitRepository', async (_, repoPath: string) => {
    try {
      const git = getGit(repoPath)
      return await git.checkIsRepo()
    } catch {
      return false
    }
  })

  ipcMain.handle('git:getLog', async (_, repoPath: string, options?: { maxCount?: number }) => {
    const git = getGit(repoPath)
    const log = await git.log({
      maxCount: options?.maxCount || 200,
      format: {
        hash: '%H',
        shortHash: '%h',
        date: '%ai',
        message: '%s',
        body: '%b',
        author_name: '%an',
        author_email: '%ae',
        refs: '%D'
      },
      multiLine: true
    })
    return log.all.map((commit: any) => ({
      ...commit,
      parents: [],
      branches: commit.refs ? commit.refs.split(', ').filter((r: string) => r.length > 0) : []
    }))
  })

  ipcMain.handle('git:getCurrentBranch', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
    return branch.trim()
  })

  ipcMain.handle('git:getBranches', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    const summary = await git.branchLocal()
    const remotes = await git.branch(['-r'])
    return {
      current: summary.current,
      all: summary.all,
      branches: Object.entries(summary.branches).map(([name, info]) => ({
        name,
        current: name === summary.current,
        commit: info.commit,
        label: info.label
      })),
      remotes: remotes.all.filter(r => !r.endsWith('HEAD')).map(r => ({
        name: r,
        display: r.replace(/^origin\//, '')
      }))
    }
  })

  ipcMain.handle('git:getStatus', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    const status: StatusResult = await git.status()
    return {
      current: status.current,
      tracking: status.tracking,
      ahead: status.ahead,
      behind: status.behind,
      isClean: status.isClean(),
      conflicted: status.conflicted,
      created: status.created,
      deleted: status.deleted,
      modified: status.modified,
      renamed: status.renamed,
      files: status.files.map(f => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir
      }))
    }
  })

  ipcMain.handle('git:getDiff', async (_, repoPath: string, file?: string, staged?: boolean) => {
    const git = getGit(repoPath)
    const args: string[] = []
    if (staged) {
      args.push('--staged')
    }
    if (file) {
      args.push('--', file)
    }
    return await git.diff(args)
  })

  ipcMain.handle('git:getCommitDiff', async (_, repoPath: string, commitHash: string, filePath?: string) => {
    const git = getGit(repoPath)
    if (filePath) {
      try {
        return await git.raw(['diff', `${commitHash}^..${commitHash}`, '--', filePath])
      } catch {
        try {
          return await git.raw(['show', `${commitHash}:${filePath}`]).then(content => {
            return `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split('\n').length} @@\n` +
              content.split('\n').map(l => '+' + l).join('\n')
          })
        } catch {
          return await git.show([commitHash])
        }
      }
    }
    return await git.show([commitHash])
  })

  ipcMain.handle('git:getCommitFiles', async (_, repoPath: string, commitHash: string) => {
    const git = getGit(repoPath)
    const summary = await git.show([
      '--format=',
      '--name-status',
      commitHash
    ])
    const lines = summary.trim().split('\n').filter(l => l.length > 0)
    return lines.map(line => {
      const parts = line.split('\t')
      const status = parts[0]
      const filePath = parts[1]
      let statusLabel = ''
      switch (status[0]) {
        case 'A': statusLabel = 'added'; break
        case 'M': statusLabel = 'modified'; break
        case 'D': statusLabel = 'deleted'; break
        case 'R': statusLabel = 'renamed'; break
        case 'C': statusLabel = 'copied'; break
        case 'U': statusLabel = 'conflict'; break
        default: statusLabel = status
      }
      return {
        status: statusLabel,
        path: filePath,
        oldPath: parts[2] || null
      }
    })
  })

  ipcMain.handle('git:add', async (_, repoPath: string, files: string[]) => {
    const git = getGit(repoPath)
    await git.add(files)
  })

  ipcMain.handle('git:addPatch', async (_, repoPath: string, filePath: string, patch: string) => {
    await runGitApplyCached(repoPath, patch)
  })

  ipcMain.handle('git:reset', async (_, repoPath: string, files?: string[]) => {
    const git = getGit(repoPath)
    if (files && files.length > 0) {
      await git.reset(['HEAD', '--', ...files])
    } else {
      await git.reset(['HEAD'])
    }
  })

  ipcMain.handle('git:resetPatch', async (_, repoPath: string, filePath: string, patch: string) => {
    const git = getGit(repoPath)
    const reversedPatch = patch
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) return '-' + line.slice(1)
        if (line.startsWith('-') && !line.startsWith('---')) return '+' + line.slice(1)
        return line
      })
      .join('\n')
    await runGitApplyCached(repoPath, reversedPatch)
  })

  ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
    try {
      const git = getGit(repoPath)
      const result = await git.commit(message)
      return { success: true, hash: result.commit }
    } catch (error) {
      return { success: false, error: handleError(error) }
    }
  })

  ipcMain.handle('git:createBranch', async (_, repoPath: string, branchName: string, fromBranch?: string) => {
    const git = getGit(repoPath)
    if (fromBranch) {
      await git.checkoutBranch(branchName, fromBranch)
    } else {
      await git.checkoutLocalBranch(branchName)
    }
  })

  ipcMain.handle('git:checkout', async (_, repoPath: string, branchName: string) => {
    const git = getGit(repoPath)
    await git.checkout(branchName)
  })

  ipcMain.handle('git:deleteBranch', async (_, repoPath: string, branchName: string, force?: boolean) => {
    const git = getGit(repoPath)
    await git.deleteLocalBranch(branchName, !!force)
  })

  ipcMain.handle('git:merge', async (_, repoPath: string, branchName: string) => {
    try {
      const git = getGit(repoPath)
      const result = await git.merge([branchName, '--no-ff'])
      if (result.conflicts && result.conflicts.length > 0) {
        return {
          success: false,
          conflicts: result.conflicts.map((c: any) => c.file),
          error: 'Merge conflicts detected'
        }
      }
      return { success: true }
    } catch (error: any) {
      const conflicts = await extractConflicts(repoPath)
      return { success: false, conflicts, error: handleError(error) }
    }
  })

  ipcMain.handle('git:rebase', async (_, repoPath: string, branchName: string) => {
    try {
      const git = getGit(repoPath)
      await git.rebase([branchName])
      return { success: true }
    } catch (error: any) {
      const conflicts = await extractConflicts(repoPath)
      return { success: false, conflicts, error: handleError(error) }
    }
  })

  async function extractConflicts(repoPath: string): Promise<string[]> {
    try {
      const git = getGit(repoPath)
      const status = await git.status()
      return status.conflicted || []
    } catch {
      return []
    }
  }

  ipcMain.handle('git:abortMerge', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    await git.merge(['--abort'])
  })

  ipcMain.handle('git:abortRebase', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    await git.rebase(['--abort'])
  })

  ipcMain.handle('git:continueRebase', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    await git.rebase(['--continue'])
  })

  ipcMain.handle('git:continueMerge', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    await git.commit(['--no-edit'])
  })

  ipcMain.handle('git:getConflicts', async (_, repoPath: string) => {
    return await extractConflicts(repoPath)
  })

  ipcMain.handle('git:resolveConflict', async (_, repoPath: string, filePath: string, content: string) => {
    const fullPath = path.join(repoPath, filePath)
    fs.writeFileSync(fullPath, content, 'utf-8')
  })

  ipcMain.handle('git:pull', async (_, repoPath: string, remote?: string, branch?: string) => {
    try {
      const git = getGit(repoPath)
      const args: string[] = []
      if (remote && branch) {
        args.push(remote, branch)
      }
      await git.pull(args)
      return { success: true }
    } catch (error: any) {
      const conflicts = await extractConflicts(repoPath)
      return { success: false, conflicts, error: handleError(error) }
    }
  })

  ipcMain.handle('git:push', async (_, repoPath: string, remote?: string, branch?: string, setUpstream?: boolean, forcePush?: boolean) => {
    const args: string[] = []
    try {
      const git = getGit(repoPath)
      if (forcePush) {
        args.push('--force')
      }
      if (setUpstream && remote && branch) {
        args.push('-u', remote, branch)
      } else if (remote && branch) {
        args.push(remote, branch)
      }
      await git.push(args)
      return { success: true, args }
    } catch (error: any) {
      const errMsg = error.message || handleError(error)
      return { success: false, error: errMsg, args }
    }
  })

  ipcMain.handle('git:getRemotes', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    const remotes = await git.getRemotes(true)
    return remotes
  })

  ipcMain.handle('git:stashList', async (_, repoPath: string) => {
    const git = getGit(repoPath)
    const result = await git.stashList()
    return result.all.map((item: any, index: number) => ({
      index,
      name: item.label || `stash@{${index}}`,
      message: item.message || item.body || '',
      date: item.date,
      branch: item.refs || ''
    }))
  })

  ipcMain.handle('git:stashPush', async (_, repoPath: string, message?: string, includeUntracked?: boolean) => {
    const git = getGit(repoPath)
    const args: string[] = ['push']
    if (includeUntracked) {
      args.push('-u')
    }
    if (message) {
      args.push('-m', message)
    }
    const result = await git.stash(args)
    return result
  })

  ipcMain.handle('git:stashApply', async (_, repoPath: string, stashIndex: number) => {
    const git = getGit(repoPath)
    await git.stash(['apply', `stash@{${stashIndex}}`])
  })

  ipcMain.handle('git:stashPop', async (_, repoPath: string, stashIndex: number) => {
    const git = getGit(repoPath)
    await git.stash(['pop', `stash@{${stashIndex}}`])
  })

  ipcMain.handle('git:stashDrop', async (_, repoPath: string, stashIndex: number) => {
    const git = getGit(repoPath)
    await git.stash(['drop', `stash@{${stashIndex}}`])
  })

  ipcMain.handle('git:readFile', async (_, repoPath: string, filePath: string) => {
    const fullPath = path.join(repoPath, filePath)
    return fs.readFileSync(fullPath, 'utf-8')
  })

  ipcMain.handle('git:writeFile', async (_, repoPath: string, filePath: string, content: string) => {
    const fullPath = path.join(repoPath, filePath)
    fs.writeFileSync(fullPath, content, 'utf-8')
  })

  ipcMain.handle('git:getTags', async (_, repoPath: string) => {
    try {
      const git = getGit(repoPath)
      const tags = await git.tags()
      return tags.all || []
    } catch {
      return []
    }
  })

  ipcMain.handle('git:getRangeDiff', async (_, repoPath: string, fromRef: string, toRef: string) => {
    try {
      const git = getGit(repoPath)
      const d = await git.raw(['diff', `${fromRef}..${toRef}`])
      return d as string
    } catch (error: any) {
      return ''
    }
  })

  ipcMain.handle('git:fetch', async (_, repoPath: string, remote?: string, prune?: boolean) => {
    try {
      const git = getGit(repoPath)
      const args: string[] = []
      if (prune) args.push('--prune')
      if (remote) args.push(remote)
      const r: any = await git.fetch(args)
      const updated = (r && r.branches) ? Object.keys(r.branches || {}).length : 0
      const tags = (r && r.tags) ? Object.keys(r.tags || {}).length : 0
      return {
        success: true,
        updated,
        tagsUpdated: tags,
        pruned: prune,
        message: updated > 0 || tags > 0 ? `更新了 ${updated} 个分支、${tags} 个标签` : (prune ? '已清理远端已删除的引用' : '已是最新，没有新内容')
      }
    } catch (error: any) {
      return { success: false, error: handleError(error) }
    }
  })

  ipcMain.handle('git:fetchAll', async (_, repoPath: string, prune?: boolean) => {
    try {
      const git = getGit(repoPath)
      const args = ['--all']
      if (prune) args.push('--prune')
      const r: any = await git.fetch(args)
      const updated = (r && r.branches) ? Object.keys(r.branches || {}).length : 0
      const tags = (r && r.tags) ? Object.keys(r.tags || {}).length : 0
      return {
        success: true,
        updated,
        tagsUpdated: tags,
        pruned: prune,
        message: updated > 0 || tags > 0 ? `从所有远端更新了 ${updated} 个分支、${tags} 个标签` : (prune ? '已清理所有远端已删除的引用' : '已是最新，没有新内容')
      }
    } catch (error: any) {
      return { success: false, error: handleError(error) }
    }
  })

  ipcMain.handle('git:remotePrune', async (_, repoPath: string, remote: string) => {
    try {
      const git = getGit(repoPath)
      await git.raw(['remote', 'prune', remote])
      return { success: true, message: `已清理远端 ${remote} 上已删除的引用` }
    } catch (error: any) {
      return { success: false, error: handleError(error) }
    }
  })
}
