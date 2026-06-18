interface GitApi {
  openRepository: (repoPath: string) => Promise<{ success: boolean; error?: string }>
  isGitRepository: (repoPath: string) => Promise<boolean>
  getLog: (repoPath: string, options?: { maxCount?: number }) => Promise<any[]>
  getCurrentBranch: (repoPath: string) => Promise<string>
  getBranches: (repoPath: string) => Promise<any>
  getStatus: (repoPath: string) => Promise<any>
  getDiff: (repoPath: string, file?: string, staged?: boolean) => Promise<string>
  getCommitDiff: (repoPath: string, commitHash: string, filePath?: string) => Promise<string>
  getCommitFiles: (repoPath: string, commitHash: string) => Promise<any[]>
  add: (repoPath: string, files: string[]) => Promise<void>
  addPatch: (repoPath: string, filePath: string, patch: string) => Promise<void>
  reset: (repoPath: string, files?: string[]) => Promise<void>
  resetPatch: (repoPath: string, filePath: string, patch: string) => Promise<void>
  commit: (repoPath: string, message: string) => Promise<{ success: boolean; hash?: string; error?: string }>
  createBranch: (repoPath: string, branchName: string, fromBranch?: string) => Promise<void>
  checkout: (repoPath: string, branchName: string) => Promise<void>
  deleteBranch: (repoPath: string, branchName: string, force?: boolean) => Promise<void>
  merge: (repoPath: string, branchName: string) => Promise<{ success: boolean; conflicts?: string[]; error?: string }>
  rebase: (repoPath: string, branchName: string) => Promise<{ success: boolean; conflicts?: string[]; error?: string }>
  abortMerge: (repoPath: string) => Promise<void>
  abortRebase: (repoPath: string) => Promise<void>
  continueRebase: (repoPath: string) => Promise<void>
  continueMerge: (repoPath: string) => Promise<void>
  getConflicts: (repoPath: string) => Promise<string[]>
  resolveConflict: (repoPath: string, filePath: string, content: string) => Promise<void>
  pull: (repoPath: string, remote?: string, branch?: string) => Promise<{ success: boolean; conflicts?: string[]; error?: string }>
  push: (repoPath: string, remote?: string, branch?: string) => Promise<{ success: boolean; error?: string }>
  getRemotes: (repoPath: string) => Promise<any[]>
  stashList: (repoPath: string) => Promise<any[]>
  stashPush: (repoPath: string, message?: string, includeUntracked?: boolean) => Promise<string>
  stashApply: (repoPath: string, stashIndex: number) => Promise<void>
  stashPop: (repoPath: string, stashIndex: number) => Promise<void>
  stashDrop: (repoPath: string, stashIndex: number) => Promise<void>
  readFile: (repoPath: string, filePath: string) => Promise<string>
  writeFile: (repoPath: string, filePath: string, content: string) => Promise<void>
}

declare global {
  interface Window {
    gitApi: GitApi
    dialogApi: {
      openDirectory: () => Promise<string | null>
    }
  }
}

export {}
