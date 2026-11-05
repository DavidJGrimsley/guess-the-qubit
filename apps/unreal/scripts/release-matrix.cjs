// Release policy matrix for Guess the Qubit Unreal target platforms
// Supported release targets: Windows, Mac, Linux as supported release policy (not a packaging ban).

const releaseMatrix = {
  application: 'Guess the Qubit (Unreal Engine)',
  engineVersion: '5.8',
  supportedPlatforms: {
    windows: {
      targetPlatform: 'Win64',
      status: 'supported',
      rhi: ['DX12 (SM6)', 'DX11 (SM5)'],
      notes: 'Primary desktop target; DX12 SM6 preferred with DX11 fallback.'
    },
    mac: {
      targetPlatform: 'Mac',
      status: 'supported',
      rhi: ['Metal (SM6)'],
      notes: 'Supported release target; requires macOS host and Xcode toolchain for packaging.'
    },
    linux: {
      targetPlatform: 'Linux',
      status: 'supported',
      rhi: ['Vulkan (SM6)'],
      notes: 'Supported release target; requires Linux toolchain or cross-compilation toolchain.'
    }
  },
  policyNotice: 'Windows, Mac, and Linux are supported release targets under release policy. Packaging is not banned; native compilation requires appropriate host toolchains and Unreal Engine 5.8.'
};

console.log(JSON.stringify(releaseMatrix, null, 2));
module.exports = releaseMatrix;
