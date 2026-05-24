const { execSync } = require('child_process');
const ports = [3000, 4000, 4001];
const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
const lines = netstat.split(/\r?\n/);
const pids = new Set();
for (const line of lines) {
  if (!line.includes('LISTENING')) continue;
  for (const port of ports) {
    const re = new RegExp('\\b' + port + '\\b');
    if (re.test(line)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
  }
}
console.log('port listeners pids=', [...pids].join(','));
for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGTERM');
    console.log('killed pid', pid);
  } catch (err) {
    console.error('kill failed', pid, err.message);
  }
}
const tasklistRaw = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV', { encoding: 'utf8' });
const tasklistLines = tasklistRaw.split(/\r?\n/).slice(1).filter(Boolean);
for (const line of tasklistLines) {
  const cols = line.split(/","/).map(s => s.replace(/^"|"$/g, ''));
  const pid = cols[1];
  if (pid && pid !== '0') {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log('killed electron pid', pid);
    } catch (err) {
      console.error('kill electron failed', pid, err.message);
    }
  }
}
console.log('cleanup complete');
