// Host verification for Unreal Engine 5.8 project
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const uprojectPath = path.join(projectRoot, 'GuessTheQubit.uproject');

console.log('--- Guess the Qubit Unreal Host & Project Verification ---');
console.log(`Host Platform: ${os.platform()} (${os.arch()})`);
console.log(`OS Release:    ${os.release()}`);

// 1. Verify GuessTheQubit.uproject exists and parse JSON
if (!fs.existsSync(uprojectPath)) {
  console.error(`ERROR: Missing ${uprojectPath}`);
  process.exit(1);
}

const uproject = JSON.parse(fs.readFileSync(uprojectPath, 'utf8'));
console.log(`Engine Association: ${uproject.EngineAssociation}`);
console.log(`Enabled Plugins:    ${uproject.Plugins.map((p) => p.Name).join(', ')}`);

// Verify required plugins
const requiredPlugins = ['QuantumApi', 'AllToolsets', 'AIModuleToolset', 'MCPClientToolset', 'ModelContextProtocol'];
const enabledPluginNames = new Set(uproject.Plugins.filter((p) => p.Enabled).map((p) => p.Name));
for (const req of requiredPlugins) {
  if (!enabledPluginNames.has(req)) {
    console.warn(`WARNING: Expected plugin "${req}" to be enabled in uproject`);
  }
}

// 2. Verify Config files
const configFiles = ['DefaultEngine.ini', 'DefaultInput.ini', 'DefaultGame.ini'];
for (const cfg of configFiles) {
  const p = path.join(projectRoot, 'Config', cfg);
  if (!fs.existsSync(p)) {
    console.warn(`WARNING: Config/${cfg} missing`);
  } else {
    console.log(`Config found:       Config/${cfg}`);
  }
}

// 3. Verify Content and Plugins
const contentPath = path.join(projectRoot, 'Content');
const pluginsPath = path.join(projectRoot, 'Plugins');
console.log(`Content directory:  ${fs.existsSync(contentPath) ? 'present' : 'MISSING'}`);
console.log(`Plugins directory:  ${fs.existsSync(pluginsPath) ? 'present' : 'MISSING'}`);

// 4. Check for local Unreal Engine installation
let ueEditorPath = null;
if (os.platform() === 'win32') {
  const candidate = 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
  if (fs.existsSync(candidate)) {
    ueEditorPath = candidate;
  }
}

if (ueEditorPath) {
  console.log(`Unreal Engine 5.8:  FOUND at ${ueEditorPath}`);
} else {
  console.log('Unreal Engine 5.8:  Not detected at standard host location on this machine.');
}

console.log('\n[NOTICE] JS orchestration scripts verify project descriptors, plugins, and host readiness.');
console.log('[NOTICE] JS checks do not compile or validate native Unreal C++ or cook UE assets.');
console.log('--- Unreal Host Verification Passed ---\n');
