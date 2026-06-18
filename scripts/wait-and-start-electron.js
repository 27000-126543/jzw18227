const net = require('net');
const { spawn } = require('child_process');

const PORT = 5180;
const MAX_WAIT = 30000;
const INTERVAL = 500;

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    socket.setTimeout(1000);
    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port, maxWait) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await checkPort(port)) {
      return true;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, INTERVAL));
  }
  return false;
}

async function main() {
  process.stdout.write(`等待 Vite 服务启动 (端口 ${PORT})`);
  const ready = await waitForPort(PORT, MAX_WAIT);
  process.stdout.write('\n');
  if (!ready) {
    console.error(`✗ 超时：Vite 服务未在 ${MAX_WAIT / 1000} 秒内启动`);
    process.exit(1);
  }
  console.log('✓ Vite 服务已就绪，启动 Electron...');
  
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  
  const proc = spawn(npmCmd, ['run', 'dev:electron'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });
  
  proc.on('exit', (code) => {
    console.log(`Electron 进程退出，代码: ${code}`);
    process.exit(code === null ? 0 : code);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
