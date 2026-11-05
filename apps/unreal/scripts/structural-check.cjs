// Static structural verification of Unreal Engine project files
const fs = require('node:fs');
const path = require('node:path');

function verifyStructure(projectRoot) {
  const errors = [];
  const uprojectPath = path.join(projectRoot, 'GuessTheQubit.uproject');

  // 1. Verify GuessTheQubit.uproject exists and parse JSON
  if (!fs.existsSync(uprojectPath)) {
    errors.push(`Missing uproject file: ${uprojectPath}`);
    return { valid: false, errors };
  }

  let uproject;
  try {
    uproject = JSON.parse(fs.readFileSync(uprojectPath, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in uproject: ${err.message}`);
    return { valid: false, errors };
  }

  if (uproject.EngineAssociation !== '5.8') {
    errors.push(`Unexpected EngineAssociation: "${uproject.EngineAssociation}" (expected "5.8")`);
  }

  // Verify required plugins in descriptor
  const requiredPlugins = ['QuantumApi', 'AllToolsets', 'AIModuleToolset', 'MCPClientToolset', 'ModelContextProtocol'];
  const pluginMap = new Map((uproject.Plugins || []).map((p) => [p.Name, p]));

  for (const req of requiredPlugins) {
    const entry = pluginMap.get(req);
    if (!entry) {
      errors.push(`Required plugin "${req}" not declared in uproject`);
    } else if (!entry.Enabled) {
      errors.push(`Required plugin "${req}" is disabled in uproject`);
    }
  }

  // Verify Config files
  const requiredConfigs = ['DefaultEngine.ini', 'DefaultInput.ini', 'DefaultGame.ini'];
  for (const cfg of requiredConfigs) {
    const p = path.join(projectRoot, 'Config', cfg);
    if (!fs.existsSync(p)) {
      errors.push(`Required config file missing: Config/${cfg}`);
    }
  }

  // Verify Content and Plugins directories
  const contentPath = path.join(projectRoot, 'Content');
  if (!fs.existsSync(contentPath)) {
    errors.push('Content directory missing');
  }

  const pluginsPath = path.join(projectRoot, 'Plugins');
  if (!fs.existsSync(pluginsPath)) {
    errors.push('Plugins directory missing');
  } else {
    // Verify QuantumApi plugin exists on disk
    const qapiUplugin = path.join(pluginsPath, 'QuantumApi', 'QuantumApi.uplugin');
    if (!fs.existsSync(qapiUplugin)) {
      errors.push(`Required plugin descriptor missing on disk: ${qapiUplugin}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    uproject
  };
}

if (require.main === module) {
  const projectRoot = path.resolve(__dirname, '..');
  console.log('--- Static Unreal Project Structural Verification ---');
  const result = verifyStructure(projectRoot);
  if (!result.valid) {
    console.error('FAIL: Structural issues detected:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log('Project file:       GuessTheQubit.uproject (valid)');
  console.log(`Engine Association: ${result.uproject.EngineAssociation}`);
  console.log(`Enabled Plugins:    ${result.uproject.Plugins.map((p) => p.Name).join(', ')}`);
  console.log('Config files:       DefaultEngine.ini, DefaultInput.ini, DefaultGame.ini (all present)');
  console.log('Content & Plugins:  present and intact');
  console.log('--- Static Structural Verification Passed ---\n');
  process.exit(0);
}

module.exports = { verifyStructure };
