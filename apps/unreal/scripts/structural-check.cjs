// Static structural verification of Unreal Engine project files.
// Pure file-system and text checks: this never loads Unreal Engine and says nothing about native compile/cook results.
const fs = require('node:fs');
const path = require('node:path');

// The plugin directory on disk is `Plugins/QuantumAPI` while the plugin and descriptor are named `QuantumApi`.
// Linux (case-sensitive) CI is the strictest consumer, so every path segment is matched by its exact case below.
const QUANTUM_PLUGIN_NAME = 'QuantumApi';
const QUANTUM_PLUGIN_DIR = 'QuantumAPI';
const QUANTUM_PLUGIN_DESCRIPTOR = 'QuantumApi.uplugin';

// Developer tooling that must stay editor-only so it does not flow into game targets.
const EDITOR_ONLY_PLUGINS = ['AllToolsets', 'AIModuleToolset', 'MCPClientToolset', 'ModelContextProtocol'];
const REQUIRED_PLUGINS = [QUANTUM_PLUGIN_NAME, ...EDITOR_ONLY_PLUGINS];
const REQUIRED_CONFIGS = ['DefaultEngine.ini', 'DefaultInput.ini', 'DefaultGame.ini'];

// Returns true only when `name` exists in `dir` with exactly this capitalization.
// fs.existsSync alone is case-insensitive on Windows and default macOS volumes and would hide casing mistakes.
function hasExactEntry(dir, name) {
  try {
    return fs.readdirSync(dir).includes(name);
  } catch {
    return false;
  }
}

function hasExactPath(root, ...segments) {
  let current = root;
  for (const segment of segments) {
    if (!hasExactEntry(current, segment)) {
      return false;
    }
    current = path.join(current, segment);
  }
  return true;
}

// Returns the lines of one [section] of an ini text, ignoring comment lines.
function readIniSection(iniText, sectionName) {
  const lines = [];
  let inSection = false;
  for (const line of iniText.split(/\r?\n/)) {
    const header = line.match(/^\s*\[(.+)\]\s*$/);
    if (header) {
      inSection = header[1] === sectionName;
    } else if (inSection && !line.trimStart().startsWith(';')) {
      lines.push(line);
    }
  }
  return lines;
}

// Returns every ApiKey value in a DefaultGame.ini text (unquoted), so callers can reject committed secrets.
function findApiKeyValues(iniText) {
  return [...iniText.matchAll(/^\s*\+?ApiKey\s*=(.*)$/gm)].map((match) =>
    match[1].trim().replace(/^"(.*)"$/, '$1').trim()
  );
}

function hasGameFeatureDataAssetManagerRule(iniText) {
  return readIniSection(iniText, '/Script/Engine.AssetManagerSettings').some((line) =>
    /^\s*\+PrimaryAssetTypesToScan=.*PrimaryAssetType="?GameFeatureData"?[,)]/.test(line)
  );
}

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

  // 2. Verify required plugins in the descriptor, and that developer tooling is editor-only
  const pluginMap = new Map((uproject.Plugins || []).map((p) => [p.Name, p]));

  for (const req of REQUIRED_PLUGINS) {
    const entry = pluginMap.get(req);
    if (!entry) {
      errors.push(`Required plugin "${req}" not declared in uproject`);
    } else if (!entry.Enabled) {
      errors.push(`Required plugin "${req}" is disabled in uproject`);
    }
  }

  for (const name of EDITOR_ONLY_PLUGINS) {
    const entry = pluginMap.get(name);
    const allowList = entry && entry.TargetAllowList;
    if (entry && !(Array.isArray(allowList) && allowList.length === 1 && allowList[0] === 'Editor')) {
      errors.push(`Developer plugin "${name}" must declare "TargetAllowList": ["Editor"] so it stays out of game targets`);
    }
  }

  // 3. Verify Config files
  for (const cfg of REQUIRED_CONFIGS) {
    if (!hasExactPath(projectRoot, 'Config', cfg)) {
      errors.push(`Required config file missing: Config/${cfg}`);
    }
  }

  if (hasExactPath(projectRoot, 'Config', 'DefaultGame.ini')) {
    const gameIni = fs.readFileSync(path.join(projectRoot, 'Config', 'DefaultGame.ini'), 'utf8');
    if (findApiKeyValues(gameIni).some((value) => value !== '')) {
      errors.push('Config/DefaultGame.ini must keep ApiKey= empty; remove the committed credential');
    }
    if (!hasGameFeatureDataAssetManagerRule(gameIni)) {
      errors.push(
        'Config/DefaultGame.ini is missing the GameFeatureData PrimaryAssetTypesToScan rule under [/Script/Engine.AssetManagerSettings]; ' +
          'UE 5.8 cook fails without it because the editor-only AllToolsets chain loads GameFeatures'
      );
    }
  }

  // 4. Verify Content and Plugins directories
  if (!hasExactPath(projectRoot, 'Content')) {
    errors.push('Content directory missing');
  }

  if (!hasExactPath(projectRoot, 'Plugins')) {
    errors.push('Plugins directory missing');
  } else if (!hasExactPath(projectRoot, 'Plugins', QUANTUM_PLUGIN_DIR, QUANTUM_PLUGIN_DESCRIPTOR)) {
    errors.push(
      `Required plugin descriptor missing on disk (exact case): Plugins/${QUANTUM_PLUGIN_DIR}/${QUANTUM_PLUGIN_DESCRIPTOR}`
    );
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
  console.log(`Editor-only tools:  ${EDITOR_ONLY_PLUGINS.join(', ')} (TargetAllowList Editor)`);
  console.log('Config files:       DefaultEngine.ini, DefaultInput.ini, DefaultGame.ini (present, ApiKey empty, GameFeatureData rule set)');
  console.log(`Plugin on disk:     Plugins/${QUANTUM_PLUGIN_DIR}/${QUANTUM_PLUGIN_DESCRIPTOR} (exact-case match)`);
  console.log('Content & Plugins:  present and intact');
  console.log('--- Static Structural Verification Passed (no native Unreal compile, cook, or automation was run) ---\n');
  process.exit(0);
}

module.exports = {
  verifyStructure,
  hasExactPath,
  findApiKeyValues,
  hasGameFeatureDataAssetManagerRule,
  QUANTUM_PLUGIN_DIR,
  QUANTUM_PLUGIN_DESCRIPTOR,
  EDITOR_ONLY_PLUGINS
};
