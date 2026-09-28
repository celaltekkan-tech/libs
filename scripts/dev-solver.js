'use strict';

// Yerel geliştirme çözücüsü. Windows uygulama denetimi pandas DLL'ini engellediği
// için testlerdeki pandas sapı öne alınır; ders programı bu API'yi kullanmaz.
const { spawn } = require('child_process');
const path = require('path');

const solverDir = path.join(__dirname, '..', 'solver');
const python =
  process.platform === 'win32'
    ? path.join(solverDir, '.venv', 'Scripts', 'python.exe')
    : path.join(solverDir, '.venv', 'bin', 'python');

const child = spawn(python, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8000'], {
  cwd: solverDir,
  env: { ...process.env, PYTHONPATH: path.join(solverDir, 'tests', 'stubs') },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code == null ? 1 : code));
