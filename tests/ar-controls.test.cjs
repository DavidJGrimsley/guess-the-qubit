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

test('dense transforms retain all three sliders and completion actions, including large-text layouts', () => {
  const h = load('features/ar/ar-transform-controls.native.tsx', {
    overrides: {
      './ar-transform': require('../src/features/ar/ar-transform.ts'),
      './ar-control.native': { ARControl: 'Control' },
    },
  });
  for (const stacked of [false, true]) {
    const changes = [];
    let repositioned = 0;
    let done = 0;
    const root = h.render('ARTransformControls', {
      testIDPrefix: 'medical',
      scale: 1,
      yaw: 90,
      height: 0,
      dense: true,
      stacked,
      disabled: false,
      pinching: false,
      rotating: false,
      repositionDisabled: false,
      onScaleChange: (value) => changes.push(['scale', value]),
      onYawChange: (value) => changes.push(['yaw', value]),
      onHeightChange: (value) => changes.push(['height', value]),
      onReposition: () => repositioned++,
      onDone: () => done++,
    });
    const fields = nodes(root).filter((n) => n.type?.name === 'ARTransformSlider');
    assert.deepEqual(
      fields.map((n) => n.props.label),
      ['Scale', 'Rotate', 'Height']
    );
    for (const field of fields) {
      const slider = nodes(h.render('ARTransformSlider', field.props)).find(
        (n) => n.type === 'Slider'
      );
      slider.props.onValueChange(0.5);
    }
    assert.deepEqual(changes, [
      ['scale', 0.5],
      ['yaw', 0.5],
      ['height', 0.5],
    ]);
    byID(root, 'medical-reposition').props.onPress();
    byID(root, 'medical-transform-done').props.onPress();
    assert.equal(repositioned, 1);
    assert.equal(done, 2);
  }
});
test('the shared transform editor opens XYZ Position, returns to transforms, and preserves completion/reposition callbacks', () => {
  const common = {
    './ar-transform': require('../src/features/ar/ar-transform.ts'),
    './ar-control.native': { ARControl: 'Control' },
  };
  const transform = load('features/ar/ar-transform-controls.native.tsx', { overrides: common });
  const position = load('features/ar/ar-position-controls.native.tsx', {
    overrides: { ...common, './ar-transform-controls.native': transform.exports },
  });
  for (const controlled of [false, true])
    for (const stacked of [false, true]) {
      const h = load('features/ar/ar-transform-editor.native.tsx', {
        overrides: {
          '@/ui/game-ar-control': {
            GameARControl: 'Control',
            GameARControlWidthContext: { Provider: 'WidthProvider' },
          },
          './ar-transform-controls.native': transform.exports,
          './ar-position-controls.native': position.exports,
        },
      });
      let editing = false,
        done = 0,
        repositioned = 0;
      const changes = [];
      const render = () =>
        h.render('ARTransformEditor', {
          scale: 1,
          yaw: 0,
          height: 0.6,
          position: { x: 0.2, y: 0.6, z: -0.3 },
          stacked,
          disabled: false,
          pinching: false,
          rotating: false,
          repositionDisabled: false,
          testIDPrefix: 'shared',
          onScaleChange: () => {},
          onYawChange: () => {},
          onHeightChange: () => {},
          onPositionChange: (axis, value) => changes.push([axis, value]),
          onDone: () => done++,
          onReposition: () => repositioned++,
          ...(controlled
            ? {
                positioning: editing,
                onPositioningChange: (value) => {
                  editing = value;
                },
              }
            : {}),
        });
      let root = render();
      root.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
      const mainProps = () =>
        nodes(render()).find((n) => n.type?.name === 'ARTransformControls').props;
      let main = transform.render('ARTransformControls', mainProps());
      byID(main, 'shared-transform-position').props.onPress();
      const positionProps = nodes(render()).find(
        (n) => n.type?.name === 'ARPositionControls'
      ).props;
      assert.deepEqual({ ...positionProps.position }, { x: 0.2, y: 0.6, z: -0.3 });
      const pos = position.render('ARPositionControls', positionProps);
      for (const axis of ['x', 'y', 'z'])
        byID(pos, `shared-position-${axis}`).props.onValueChange(0.4);
      assert.deepEqual(changes, [
        ['x', 0.4],
        ['y', 0.4],
        ['z', 0.4],
      ]);
      byID(pos, 'shared-position-done').props.onPress();
      assert.equal(done, 0, 'Position Done returns to the transform editor');
      main = transform.render('ARTransformControls', mainProps());
      byID(main, 'shared-reposition').props.onPress();
      assert.equal(repositioned, 1);
      assert.equal(done, 1);
      byID(main, 'shared-transform-done').props.onPress();
      assert.equal(done, 2);
    }
});
