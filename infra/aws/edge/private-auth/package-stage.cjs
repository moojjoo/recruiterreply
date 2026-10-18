'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateEnvironment } = require('./deployment-handler.cjs');

const SOURCE_FILES = Object.freeze([
  'complete-oauth-login.cjs',
  'deployment-handler.cjs',
  'dynamodb-replay-store.cjs',
  'fetch-jwks.cjs',
  'fetch-github-jwks.cjs',
  'github-oidc.cjs',
  'oauth-authorize.cjs',
  'oauth-callback.cjs',
  'oauth-nonce.cjs',
  'oauth-pkce.cjs',
  'oauth-replay-guard.cjs',
  'oauth-token-exchange.cjs',
  'oauth-transaction.cjs',
  'origin-signature.cjs',
  'sealed-cookie.cjs',
  'secrets-manager-key-provider.cjs',
  'session-cookie.cjs',
  'session-gateway.cjs',
  'validate-oauth-tokens.cjs',
  'verify-id-token.cjs',
  'viewer-request.cjs',
  'package.json',
  'package-lock.json'
]);

const CONFIG_KEYS = Object.freeze([
  'clientId',
  'domain',
  'host',
  'issuer',
  'replayTableName',
  'signApiOriginRequests',
  'signingKeySecretId'
]);

function validatePackageConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Package configuration must be an object');
  }

  const entries = Object.entries(config);
  if (entries.length !== 1) {
    throw new Error('A package must contain exactly one private environment');
  }

  const [distributionId, environment] = entries[0];
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('Private environment configuration must be an object');
  }

  const keys = Object.keys(environment).sort();
  const legacyKeys = CONFIG_KEYS;
  const ciKeys = ['ciAuth', ...CONFIG_KEYS];
  const matches = [legacyKeys, ciKeys].some(expected =>
    keys.length === expected.length && keys.every((key, index) => key === expected[index])
  );
  if (!matches) {
    throw new Error('Private environment configuration has unknown or missing fields');
  }

  validateEnvironment(distributionId, environment);
  return config;
}

function renderConfigModule(config) {
  validatePackageConfig(config);
  return `'use strict';\n\nmodule.exports = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
}

function renderEntryModule() {
  return [
    "'use strict';",
    '',
    "const config = require('./deployment-config.cjs');",
    "const { createDeploymentHandler } = require('./deployment-handler.cjs');",
    '',
    'exports.handler = createDeploymentHandler(config);',
    ''
  ].join('\n');
}

function stagePackage({ configPath, outputPath, installDependencies = true }) {
  const sourceDirectory = __dirname;
  const resolvedConfig = path.resolve(configPath);
  const resolvedOutput = path.resolve(outputPath);

  if (resolvedOutput === sourceDirectory || resolvedOutput.startsWith(`${sourceDirectory}${path.sep}`)) {
    throw new Error('Package output must be outside the source directory');
  }
  if (fs.existsSync(resolvedOutput)) {
    throw new Error('Package output path already exists');
  }

  const configText = fs.readFileSync(resolvedConfig, 'utf8');
  if (Buffer.byteLength(configText) > 65536) {
    throw new Error('Package configuration is too large');
  }
  const config = validatePackageConfig(JSON.parse(configText));

  fs.mkdirSync(resolvedOutput, { recursive: false, mode: 0o700 });
  for (const file of SOURCE_FILES) {
    fs.copyFileSync(path.join(sourceDirectory, file), path.join(resolvedOutput, file));
  }
  fs.writeFileSync(
    path.join(resolvedOutput, 'deployment-config.cjs'),
    renderConfigModule(config),
    { encoding: 'utf8', mode: 0o600 }
  );
  fs.writeFileSync(
    path.join(resolvedOutput, 'index.js'),
    renderEntryModule(),
    { encoding: 'utf8', mode: 0o600 }
  );

  if (installDependencies) {
    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: resolvedOutput, encoding: 'utf8', stdio: 'inherit' }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Production dependency installation failed');
  }

  return resolvedOutput;
}

function parseArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--config', '--output'].includes(flag) || !value) {
      throw new Error('Usage: node package-stage.cjs --config <file> --output <new-directory>');
    }
    args[flag.slice(2)] = value;
  }
  if (!args.config || !args.output) {
    throw new Error('Usage: node package-stage.cjs --config <file> --output <new-directory>');
  }
  return args;
}

if (require.main === module) {
  const args = parseArguments(process.argv.slice(2));
  const output = stagePackage({ configPath: args.config, outputPath: args.output });
  process.stdout.write(`${output}\n`);
}

module.exports = {
  CONFIG_KEYS,
  SOURCE_FILES,
  parseArguments,
  renderConfigModule,
  renderEntryModule,
  stagePackage,
  validatePackageConfig
};
