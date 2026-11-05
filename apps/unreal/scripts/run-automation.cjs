// Automation runner for Unreal Engine tests if UE is available on host
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const uprojectPath = path.join(projectRoot, 'GuessTheQubit.uproject');

let ueEditorCmd = null;
if (os.platform() === 'win32') {
  const standardPath = 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
  if (fs.existsSync(standardPath)) {
    ueEditorCmd = standardPath;
  }
}

if (!ueEditorCmd) {
  console.log('Unreal Engine 5.8 editor CLI not found on this host. Skipping native automation tests.');
  process.exit(0);
}

console.log(`Running Unreal Engine automation tests using: ${ueEditorCmd}`);
const result = spawnSync(
  ueEditorCmd,
  [
    uprojectPath,
    '-ExecCmds=Automation RunTests QuantumApi; Quit',
    '-stdout',
    '-nosplash',
    '-nullrhi',
    '-unattended'
  ],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120000
  }
);

if (result.stdout) {
  console.log(result.stdout);
}
if (result.stderr) {
  console.error(result.stderr);
}
if (result.error) {
  console.error('Execution error:', result.error);
}
console.log(`Automation command exit code: ${result.status}`);
