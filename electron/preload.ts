import { contextBridge, ipcRenderer } from 'electron'
import type { GitApi } from './types/api'

const gitApi: GitApi = {
  openRepository: (repoPath) => ipcRenderer.invoke('git:openRepository', repoPath),
  isGitRepository: (repoPath) => ipcRenderer.invoke('git:isGitRepository', repoPath),
  getLog: (repoPath, options) => ipcRenderer.invoke('git:getLog', repoPath, options),
  getCurrentBranch: (repoPath) => ipcRenderer.invoke('git:getCurrentBranch', repoPath),
  getBranches: (repoPath) => ipcRenderer.invoke('git:getBranches', repoPath),
  getStatus: (repoPath) => ipcRenderer.invoke('git:getStatus', repoPath),
  getDiff: (repoPath, file, staged) => ipcRenderer.invoke('git:getDiff', repoPath, file, staged),
  getCommitDiff: (repoPath, commitHash, filePath) => ipcRenderer.invoke('git:getCommitDiff', repoPath, commitHash, filePath),
  getCommitFiles: (repoPath, commitHash) => ipcRenderer.invoke('git:getCommitFiles', repoPath, commitHash),
  add: (repoPath, files) => ipcRenderer.invoke('git:add', repoPath, files),
  addPatch: (repoPath, filePath, patch) => ipcRenderer.invoke('git:addPatch', repoPath, filePath, patch),
  reset: (repoPath, files) => ipcRenderer.invoke('git:reset', repoPath, files),
  resetPatch: (repoPath, filePath, patch) => ipcRenderer.invoke('git:resetPatch', repoPath, filePath, patch),
  commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  createBranch: (repoPath, branchName, fromBranch) => ipcRenderer.invoke('git:createBranch', repoPath, branchName, fromBranch),
  checkout: (repoPath, branchName) => ipcRenderer.invoke('git:checkout', repoPath, branchName),
  deleteBranch: (repoPath, branchName, force) => ipcRenderer.invoke('git:deleteBranch', repoPath, branchName, force),
  merge: (repoPath, branchName) => ipcRenderer.invoke('git:merge', repoPath, branchName),
  rebase: (repoPath, branchName) => ipcRenderer.invoke('git:rebase', repoPath, branchName),
  abortMerge: (repoPath) => ipcRenderer.invoke('git:abortMerge', repoPath),
  abortRebase: (repoPath) => ipcRenderer.invoke('git:abortRebase', repoPath),
  continueRebase: (repoPath) => ipcRenderer.invoke('git:continueRebase', repoPath),
  continueMerge: (repoPath) => ipcRenderer.invoke('git:continueMerge', repoPath),
  getConflicts: (repoPath) => ipcRenderer.invoke('git:getConflicts', repoPath),
  resolveConflict: (repoPath, filePath, content) => ipcRenderer.invoke('git:resolveConflict', repoPath, filePath, content),
  pull: (repoPath, remote, branch) => ipcRenderer.invoke('git:pull', repoPath, remote, branch),
  push: (repoPath, remote, branch) => ipcRenderer.invoke('git:push', repoPath, remote, branch),
  getRemotes: (repoPath) => ipcRenderer.invoke('git:getRemotes', repoPath),
  stashList: (repoPath) => ipcRenderer.invoke('git:stashList', repoPath),
  stashPush: (repoPath, message, includeUntracked) => ipcRenderer.invoke('git:stashPush', repoPath, message, includeUntracked),
  stashApply: (repoPath, stashIndex) => ipcRenderer.invoke('git:stashApply', repoPath, stashIndex),
  stashPop: (repoPath, stashIndex) => ipcRenderer.invoke('git:stashPop', repoPath, stashIndex),
  stashDrop: (repoPath, stashIndex) => ipcRenderer.invoke('git:stashDrop', repoPath, stashIndex),
  readFile: (repoPath, filePath) => ipcRenderer.invoke('git:readFile', repoPath, filePath),
  writeFile: (repoPath, filePath, content) => ipcRenderer.invoke('git:writeFile', repoPath, filePath, content)
}

const dialogApi = {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory')
}

contextBridge.exposeInMainWorld('gitApi', gitApi)
contextBridge.exposeInMainWorld('dialogApi', dialogApi)

export type { GitApi }
