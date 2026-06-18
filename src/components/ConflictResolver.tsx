import { useState, useEffect, useCallback } from 'react'
import { ConflictSection, ParsedConflict } from '../types/git'

interface Props {
  repoPath: string
  conflicts: string[]
  onClose: () => void
  onRefreshConflictList: () => Promise<string[]>
}

function parseConflictContent(content: string, filePath: string): ParsedConflict {
  const lines = content.split('\n')
  const sections: ConflictSection[] = []
  let current: Partial<ConflictSection> | null = null
  let sectionType: 'ours' | 'theirs' | 'base' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('<<<<<<<')) {
      current = { startLine: i + 1, ours: [], theirs: [] }
      sectionType = 'ours'
    } else if (line.startsWith('=======')) {
      if (current) sectionType = 'theirs'
    } else if (line.startsWith('>>>>>>>')) {
      if (current) {
        current.endLine = i + 1
        sections.push(current as ConflictSection)
        current = null
        sectionType = null
      }
    } else if (current && sectionType) {
      if (sectionType === 'ours') current.ours!.push(line)
      else if (sectionType === 'theirs') current.theirs!.push(line)
    }
  }

  return { filePath, sections, content, lines }
}

function buildResolvedContent(
  parsed: ParsedConflict,
  resolutions: Map<number, 'ours' | 'theirs' | 'both' | 'custom'>,
  customContents: Map<number, string>
): string {
  const result: string[] = []
  const { lines, sections } = parsed
  let currentSectionIdx = 0
  let i = 0

  while (i < lines.length) {
    const section = sections[currentSectionIdx]
    if (section && i + 1 === section.startLine) {
      const res = resolutions.get(currentSectionIdx) || 'ours'
      if (res === 'ours') {
        result.push(...section.ours)
      } else if (res === 'theirs') {
        result.push(...section.theirs)
      } else if (res === 'both') {
        result.push(...section.ours)
        result.push(...section.theirs)
      } else if (res === 'custom') {
        const custom = customContents.get(currentSectionIdx) || ''
        result.push(...custom.split('\n'))
      }
      i = section.endLine - 1 + 1
      currentSectionIdx++
    } else {
      result.push(lines[i])
      i++
    }
  }

  return result.join('\n')
}

const COLOR_OURS = 'rgba(0, 120, 212, 0.15)'
const COLOR_THEIRS = 'rgba(216, 59, 1, 0.15)'
const COLOR_MERGED = 'rgba(16, 124, 16, 0.15)'

export default function ConflictResolver({
  repoPath, conflicts, onClose, onRefreshConflictList
}: Props) {
  const [currentFile, setCurrentFile] = useState<string>(conflicts[0] || '')
  const [parsed, setParsed] = useState<ParsedConflict | null>(null)
  const [resolutions, setResolutions] = useState<Map<number, 'ours' | 'theirs' | 'both' | 'custom'>>(new Map())
  const [customContents, setCustomContents] = useState<Map<number, string>>(new Map())
  const [saving, setSaving] = useState(false)
  const [editedFiles, setEditedFiles] = useState<Set<string>>(new Set())
  const [showAllResolved, setShowAllResolved] = useState(false)

  const loadFile = useCallback(async (file: string) => {
    try {
      const content = await window.gitApi.readFile(repoPath, file)
      const p = parseConflictContent(content, file)
      setParsed(p)
      setResolutions(new Map(p.sections.map((_, i) => [i, 'ours'] as const)))
      const customs = new Map<number, string>()
      p.sections.forEach((s, i) => {
        customs.set(i, s.ours.join('\n'))
      })
      setCustomContents(customs)
    } catch (e: any) {
      alert('读取文件失败: ' + e.message)
    }
  }, [repoPath])

  useEffect(() => {
    if (currentFile) loadFile(currentFile)
  }, [currentFile, loadFile])

  useEffect(() => {
    if (!currentFile && conflicts.length > 0) {
      setCurrentFile(conflicts[0])
    }
  }, [conflicts, currentFile])

  const setResolution = (idx: number, r: 'ours' | 'theirs' | 'both' | 'custom') => {
    const newR = new Map(resolutions)
    newR.set(idx, r)
    setResolutions(newR)
    if ((r === 'ours' || r === 'theirs') && parsed) {
      const section = parsed.sections[idx]
      const newC = new Map(customContents)
      newC.set(idx, (r === 'ours' ? section.ours : section.theirs).join('\n'))
      setCustomContents(newC)
    }
  }

  const setCustomContent = (idx: number, content: string) => {
    const newC = new Map(customContents)
    newC.set(idx, content)
    setCustomContents(newC)
    const newR = new Map(resolutions)
    newR.set(idx, 'custom')
    setResolutions(newR)
  }

  const handleSaveAndStage = async () => {
    if (!parsed) return
    try {
      setSaving(true)
      const resolved = buildResolvedContent(parsed, resolutions, customContents)
      await window.gitApi.resolveConflict(repoPath, parsed.filePath, resolved)
      await window.gitApi.add(repoPath, [parsed.filePath])
      setEditedFiles(s => new Set(s).add(parsed.filePath))
      const remaining = await onRefreshConflictList()
      if (remaining.length === 0) {
        alert('所有冲突已解决并暂存！\n\n可以在分支管理面板点击"继续变基"或返回暂存区提交。')
      } else {
        const nextIdx = remaining.findIndex(f => f !== parsed.filePath)
        if (nextIdx >= 0) {
          setCurrentFile(remaining[nextIdx])
        }
      }
    } catch (e: any) {
      alert('保存失败: ' + e.message)
    } finally { setSaving(false) }
  }

  const handleResolveAllOurs = () => {
    if (!parsed) return
    const newR = new Map<number, any>()
    parsed.sections.forEach((_, i) => newR.set(i, 'ours'))
    setResolutions(newR)
  }

  const handleResolveAllTheirs = () => {
    if (!parsed) return
    const newR = new Map<number, any>()
    parsed.sections.forEach((_, i) => newR.set(i, 'theirs'))
    setResolutions(newR)
  }

  const resolved = parsed ? buildResolvedContent(parsed, resolutions, customContents) : ''
  const unresolvedCount = conflicts.length

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={e => {
      if (showAllResolved && unresolvedCount === 0) onClose()
    }}>
      <div
        className="modal"
        style={{ width: '95vw', height: '92vh', maxWidth: 'none', maxHeight: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ background: 'rgba(210, 170, 0, 0.1)', borderBottom: '1px solid var(--accent-yellow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-yellow)' }}>合并冲突解决</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                还剩 <strong style={{ color: unresolvedCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{unresolvedCount}</strong> 个冲突文件
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title={unresolvedCount > 0 ? '稍后继续解决' : '关闭'} style={{ fontSize: 20, padding: '4px 10px' }}>
            {unresolvedCount > 0 ? '_' : '×'}
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div style={{
            width: 260, display: 'flex', flexDirection: 'column', flexShrink: 0,
            borderRight: '1px solid var(--border-color)'
          }}>
            <div className="panel-header" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              📂 冲突文件列表
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {conflicts.map(f => (
                <div
                  key={f}
                  className={`file-tree-item ${currentFile === f ? 'selected' : ''}`}
                  style={{ padding: '7px 14px', gap: 8, borderBottom: '1px solid var(--border-color)' }}
                  onClick={() => setCurrentFile(f)}
                >
                  <span className={`status-dot ${editedFiles.has(f) ? 'status-added' : 'status-conflict'}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {f.split(/[\\/]/).pop()}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {f}
                    </div>
                  </div>
                  {editedFiles.has(f) && <span className="badge" style={{ background: 'var(--accent-green)', color: 'white', fontSize: 10 }}>已解</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {parsed && parsed.sections.length > 0 ? (
              <>
                <div style={{
                  padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📄 {parsed.filePath}
                    <span className="badge" style={{ marginLeft: 10 }}>{parsed.sections.length} 处冲突</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleResolveAllOurs}>
                      🔵 全部采用当前
                    </button>
                    <button className="btn btn-secondary" onClick={handleResolveAllTheirs}>
                      🟠 全部采用传入
                    </button>
                    <button className="btn btn-success" onClick={handleSaveAndStage} disabled={saving}>
                      {saving ? '保存中...' : '✓ 保存并暂存此文件'}
                    </button>
                  </div>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr',
                  borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', flexShrink: 0
                }}>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🔵 当前分支版本 (Ours)
                  </div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: '1px solid var(--border-color)' }}>
                    🟠 传入分支版本 (Theirs)
                  </div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: '1px solid var(--border-color)' }}>
                    ✅ 合并结果 (可编辑)
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                  {parsed.sections.map((section, idx) => {
                    const res = resolutions.get(idx) || 'ours'
                    return (
                      <div key={idx} style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <div style={{
                          padding: '6px 14px', background: 'var(--bg-tertiary)',
                          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                          position: 'sticky', top: 0, zIndex: 2
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>冲突 #{idx + 1}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>行 {section.startLine} - {section.endLine}</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-icon"
                              onClick={() => setResolution(idx, 'ours')}
                              style={{
                                background: res === 'ours' ? 'var(--accent-blue)' : 'transparent',
                                color: res === 'ours' ? 'white' : 'var(--accent-blue)',
                                border: `1px solid ${res === 'ours' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                fontSize: 11, padding: '3px 10px', borderRadius: 3
                              }}
                            >
                              采用当前
                            </button>
                            <button
                              className="btn btn-icon"
                              onClick={() => setResolution(idx, 'theirs')}
                              style={{
                                background: res === 'theirs' ? 'var(--accent-orange)' : 'transparent',
                                color: res === 'theirs' ? 'white' : 'var(--accent-orange)',
                                border: `1px solid ${res === 'theirs' ? 'var(--accent-orange)' : 'var(--border-color)'}`,
                                fontSize: 11, padding: '3px 10px', borderRadius: 3
                              }}
                            >
                              采用传入
                            </button>
                            <button
                              className="btn btn-icon"
                              onClick={() => setResolution(idx, 'both')}
                              style={{
                                background: res === 'both' ? 'var(--accent-purple)' : 'transparent',
                                color: res === 'both' ? 'white' : 'var(--accent-purple)',
                                border: `1px solid ${res === 'both' ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                                fontSize: 11, padding: '3px 10px', borderRadius: 3
                              }}
                            >
                              保留两者
                            </button>
                            <button
                              className="btn btn-icon"
                              onClick={() => setResolution(idx, 'custom')}
                              style={{
                                background: res === 'custom' ? 'var(--accent-green)' : 'transparent',
                                color: res === 'custom' ? 'white' : 'var(--accent-green)',
                                border: `1px solid ${res === 'custom' ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                fontSize: 11, padding: '3px 10px', borderRadius: 3
                              }}
                            >
                              自定义
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1.4fr', minHeight: 120 }}>
                          <pre style={{
                            margin: 0, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12,
                            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            background: res === 'ours' ? COLOR_OURS : 'transparent',
                            borderRight: 'none',
                            transition: 'background 0.2s',
                            overflow: 'hidden'
                          }}>
{section.ours.join('\n') || <span style={{ color: 'var(--text-muted)' }}>(空)</span>}
                          </pre>
                          <div style={{ background: 'var(--border-color)' }} />
                          <pre style={{
                            margin: 0, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12,
                            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            background: res === 'theirs' ? COLOR_THEIRS : 'transparent',
                            transition: 'background 0.2s',
                            overflow: 'hidden'
                          }}>
{section.theirs.join('\n') || <span style={{ color: 'var(--text-muted)' }}>(空)</span>}
                          </pre>
                          <div style={{ background: 'var(--border-color)' }} />
                          <textarea
                            value={
                              res === 'ours' ? section.ours.join('\n') :
                              res === 'theirs' ? section.theirs.join('\n') :
                              res === 'both' ? [...section.ours, ...section.theirs].join('\n') :
                              (customContents.get(idx) || '')
                            }
                            onChange={e => setCustomContent(idx, e.target.value)}
                            style={{
                              margin: 0, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12,
                              lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                              background: COLOR_MERGED,
                              border: 'none', borderRadius: 0, resize: 'none', width: '100%',
                              minHeight: 120, color: 'var(--text-primary)'
                            }}
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{
                  flex: '0 0 auto', borderTop: '2px solid var(--accent-green)', padding: 12,
                  background: 'var(--bg-secondary)'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                    📄 文件合并结果预览 ({resolved.split('\n').length} 行)
                  </div>
                  <pre style={{
                    maxHeight: 180, overflow: 'auto', margin: 0, padding: 12,
                    fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
                    background: 'var(--bg-primary)', borderRadius: 4,
                    border: '1px solid var(--border-color)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    color: 'var(--text-primary)'
                  }}>
{resolved}
                  </pre>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">该文件无冲突标记</div>
                <div className="empty-state-desc">请选择左侧列表中的其他冲突文件</div>
              </div>
            )}
          </div>
        </div>

        {unresolvedCount === 0 && (
          <div className="modal-footer" style={{ background: 'rgba(16, 124, 16, 0.1)', borderTop: '2px solid var(--accent-green)' }}>
            <div style={{ marginRight: 'auto', fontSize: 14, color: 'var(--accent-green)', fontWeight: 600 }}>
              🎉 所有冲突文件均已解决
            </div>
            <button className="btn btn-secondary" onClick={onClose}>
              返回主界面
            </button>
            <button className="btn btn-success" onClick={async () => {
              const cont = confirm('是否继续变基/合并操作？\n\n点击"是"执行继续操作，"否"仅关闭窗口，之后可手动在分支管理面板继续。')
              if (cont) {
                try {
                  await window.gitApi.continueRebase(repoPath)
                  alert('✓ 操作完成')
                } catch (e: any) {
                  try {
                    await window.gitApi.continueMerge(repoPath)
                    alert('✓ 操作完成')
                  } catch (e2: any) {
                    alert('继续失败，请手动在分支管理面板处理')
                  }
                }
              }
              onClose()
            }}>
              继续变基/合并
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
