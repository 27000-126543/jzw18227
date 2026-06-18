interface Props {
  onOpen: () => void
}

export default function WelcomeScreen({ onOpen }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1e1e 0%, #252526 100%)'
    }}>
      <div style={{
        maxWidth: 560, width: '100%', padding: 48, textAlign: 'center',
        background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🌿</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
          Git Visual Manager
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 36 }}>
          本地 Git 仓库可视化管理工具<br />
          提交历史树 · 暂存区管理 · 分支操作 · 冲突解决 · Stash 管理
        </p>
        <button
          className="btn btn-primary"
          onClick={onOpen}
          style={{ fontSize: 15, padding: '12px 32px' }}
        >
          📁 打开本地 Git 仓库
        </button>
        <div style={{
          marginTop: 48, paddingTop: 28, borderTop: '1px solid var(--border-color)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20
        }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🌳</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>历史树</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>图形化提交展示</div>
          </div>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>✏️</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>逐行暂存</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>精细控制变更</div>
          </div>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🔀</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>冲突解决</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>三栏可视化对比</div>
          </div>
        </div>
      </div>
    </div>
  )
}
