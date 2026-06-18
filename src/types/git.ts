export interface Commit {
  hash: string
  shortHash: string
  date: string
  message: string
  body: string
  author_name: string
  author_email: string
  refs: string
  parents: string[]
  branches: string[]
  treeLevel?: number
}

export interface GitStatus {
  current: string
  tracking: string | null
  ahead: number
  behind: number
  isClean: boolean
  conflicted: string[]
  created: string[]
  deleted: string[]
  modified: string[]
  renamed: any[]
  files: {
    path: string
    index: string
    working_dir: string
  }[]
}

export interface StatusFile {
  path: string
  status: 'untracked' | 'modified' | 'deleted' | 'staged_added' | 'staged_modified' | 'staged_deleted' | 'renamed' | 'conflict'
  stage: 'staged' | 'unstaged'
}

export interface BranchInfo {
  name: string
  current: boolean
  commit: string
  label: string
}

export interface RemoteInfo {
  name: string
  refs: {
    fetch: string
    push: string
  }
}

export interface StashItem {
  index: number
  name: string
  message: string
  date: string
  branch: string
}

export interface CommitFile {
  status: string
  path: string
  oldPath: string | null
}

export interface ConflictSection {
  startLine: number
  endLine: number
  ours: string[]
  theirs: string[]
  base?: string[]
}

export interface ParsedConflict {
  filePath: string
  sections: ConflictSection[]
  content: string
  lines: string[]
}

export type ViewPanel = 'none' | 'stash' | 'remotes'
export type TabKey = 'history' | 'changes' | 'branches'
