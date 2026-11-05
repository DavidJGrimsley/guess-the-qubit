const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const colors = {
  primary: '#60a5fa',
  secondary: '#a78bfa',
  background: '#09090b',
  surface: '#18181b',
  text: '#f8fafc',
};
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const flatten = (style) =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style ?? {});
const ui = Object.fromEntries(
  [
    'Host',
    'Column',
    'Row',
    'RNHostView',
    'ScrollView',
    'BottomSheet',
    'Button',
    'Text',
    'Slider',
    'Switch',
  ].map((name) => [name, name])
);
const modifiers = Object.fromEntries(
  [
    'frame',
    'onGeometryChange',
    'preferredColorScheme',
    'fillMaxHeight',
    'fillMaxWidth',
    'onSizeChanged',
    'accessibilityLabel',
    'accessibilityValue',
    'height',
    'semantics',
    'disabled',
    'fixedSize',
    'pickerStyle',
    'tag',
  ].map((name) => [name, (value) => ({ name, value })])
);
function load(
  file,
  {
    viewport = { width: 390, height: 844, fontScale: 1 },
    platform = 'ios',
    overrides = {},
    expose = '',
  } = {}
) {
  let index = 0;
  const states = [];
  const callbacks = new Map();
  let nextFrame = 0;
  const react = {
    lazy: () => 'Lazy',
    Suspense: 'Suspense',
    createContext: (value) => ({ value, Provider: 'Provider' }),
    useContext: (context) => context.value,
    useState: (initial) => {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [
        states[slot],
        (value) => {
          states[slot] = typeof value === 'function' ? value(states[slot]) : value;
        },
      ];
    },
    useEffect: () => {},
    useSyncExternalStore: (_, get) => get(),
  };
  const native = {
    Platform: { OS: platform, Version: 26 },
    StyleSheet: { create: (value) => value },
    View: 'View',
    Text: 'RNText',
    Pressable: 'Pressable',
    useWindowDimensions: () => viewport,
    NativeModules: {},
    TurboModuleRegistry: { get: () => null },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui': { ...ui, Picker: Object.assign('Picker', { Item: 'PickerItem' }) },
    '@expo/ui/swift-ui': { Picker: 'NativePicker', Text: 'NativeText' },
    '@expo/ui/jetpack-compose': {
      DropdownMenu: 'DropdownMenu',
      DropdownMenuItem: 'DropdownMenuItem',
    },
    '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': native,
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }),
    },
    '@/theme/provider': { useAppTheme: () => ({ activeColors: colors, colors: { dark: colors } }) },
    '@/ui/use-game-window-dimensions': { useGameWindowDimensions: () => viewport },
    '@/ui/game-button': { GameButton: 'GameButton' },
    '@/ui/game-text': { GameCopy: 'Copy', GameText: 'Copy' },
    '@/ui/game-progress': { GameProgress: 'Progress' },
    './medical-ui': {
      MedicalControl: 'Control',
      MedicalChoiceGroup: 'ChoiceGroup',
      MedicalWidthProvider: 'WidthProvider',
      useMedicalColors: () => colors,
    },
    './medical-sheet.native': { MedicalSheet: 'Sheet' },
    '@/features/ar/ar-transform-controls.native': { ARTransformControls: 'Transform' },
    '@/features/ar/ar-transform-editor.native': { ARTransformEditor: 'Transform' },
    '@/features/ar/ar-session-boundary': { default: 'ARBoundary' },
    'expo-router/stack': {
      Stack: Object.assign('Stack', {
        Screen: 'StackScreen',
        Toolbar: Object.assign('Toolbar', { Button: 'ToolbarButton' }),
      }),
    },
    './medical-info.native': { MedicalInfoButton: 'InfoButton', MedicalInfoModal: 'InfoModal' },
    './medical-model-picker.native': { MedicalModelPicker: 'ModelPicker' },
    './medical-model-availability': { default: 'AvailabilityPicker' },
    './medical-transform-controls.native': { MedicalTransformControls: 'AnatomyTransform' },
    './medical-slice-controls.native': {
      MedicalSliceControls: 'Slices',
      MedicalPanelTransformControls: 'PanelTransform',
    },
    './medical-volume-controls.native': {
      MedicalVolumeControls: 'Volume',
      MedicalVolumeSheet: 'VolumeSheet',
      MedicalVolumeTransformControls: 'VolumeTransform',
    },
    './medical-slice-assets.native': {},
    './medical-volume-assets.native': {},
    'expo-constants': { default: { nativeAppVersion: 'test', nativeBuildVersion: 'test' } },
    '@reactvision/react-viro/package.json': { version: '3.0.3' },
    ...overrides,
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8') + expose, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      requestAnimationFrame: (callback) => {
        const id = ++nextFrame;
        callbacks.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => callbacks.delete(id),
      require: (name) => {
        if (!(name in mocks)) throw new Error('Missing mock ' + name);
        return mocks[name];
      },
    }
  );
  return {
    exports: module.exports,
    viewport,
    render: (name, props) => {
      index = 0;
      return module.exports[name](props);
    },
    flush: () => {
      for (const callback of callbacks.values()) callback();
      callbacks.clear();
    },
  };
}
function nodes(root) {
  const result = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    result.push(node);
    walk(node.props?.children);
  }
  walk(root);
  return result;
}
const byID = (root, id) => nodes(root).find((node) => node.props.testID === id);

test('app transforms wire XYZ Position to the shared editor and live scoped controller', () => {
  const { QubitRoundController } = require('../src/features/guess-the-qubit/qubit-round-controller.ts');
  const shared = {
    '@/features/ar/ar-transform-editor.native': { ARTransformEditor: 'Editor' },
    './qubit-round-controller': require('../src/features/guess-the-qubit/qubit-round-controller.ts'),
  };
  const cases = [];
  const q = new QubitRoundController(() => null);
  q.attach(1);
  q.setTracking(1, true);
  q.setPlaced(1, true);
  const qs = q.getSnapshot();
  cases.push({
    file: 'guess-the-qubit/qubit-transform-controls.native.tsx',
    name: 'QubitTransformControls',
    controller: q,
    props: {
      state: qs,
      scope: { sessionId: 1, placementRevision: qs.placementRevision, roundId: qs.roundId },
      stacked: false,
    },
    read: () => ({
      x: q.getSnapshot().sphereX,
      y: q.getSnapshot().sphereHeight,
      z: q.getSnapshot().sphereZ,
    }),
  });
  for (const entry of cases) {
    const h = load('features/' + entry.file, { overrides: shared });
    const root = h.render(entry.name, {
      ...entry.props,
      controller: entry.controller,
      onDone: () => {},
    });
    assert.equal(root.type, 'Editor');
    assert.equal(typeof root.props.onReposition, 'function');
    for (const [axis, value] of [
      ['x', 0.4],
      ['y', 0.8],
      ['z', -0.2],
    ])
      root.props.onPositionChange(axis, value);
    assert.deepEqual(entry.read(), { x: 0.4, y: 0.8, z: -0.2 }, entry.name);
    root.props.onScaleChange(1.5);
    root.props.onYawChange(45);
    assert.deepEqual(entry.read(), { x: 0.4, y: 0.8, z: -0.2 }, 'scale/yaw cannot move position');
  }
});
