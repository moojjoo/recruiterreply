'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  SOURCE_FILES,
  parseArguments,
  renderConfigModule,
  renderEntryModule,
  stagePackage,
  validatePackageConfig
} = require('./package-stage.cjs');

function devConfig(overrides = {}) {
  return {
    E2JWU1TLDA6YRS: {
      host: 'dev.recruiterreply.com',
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV123',
      clientId: 'devclient123',
      domain: 'recruiterreply-dev.auth.us-east-1.amazoncognito.com',
      signingKeySecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dev',
      replayTableName: 'recruiterreply-dev-oauth-replay',
      ...overrides
    }
  };
}

test('accepts exactly one approved private environment', () => {
  assert.deepEqual(validatePackageConfig(devConfig()), devConfig());
});

test('rejects empty, multi-environment, Production, and extra-field packages', () => {
  assert.throws(() => validatePackageConfig({}), /exactly one/);
  assert.throws(
    () => validatePackageConfig({ ...devConfig(), E2IGR9MYMWVQFI: devConfig().E2JWU1TLDA6YRS }),
    /exactly one/
  );
  assert.throws(
    () => validatePackageConfig({ EHWW9BKSSF64L: {
      ...devConfig().E2JWU1TLDA6YRS,
      host: 'recruiterreply.com'
    } }),
    /Unapproved private environment/
  );
  assert.throws(
    () => validatePackageConfig(devConfig({ sessionSigningKey: 'do-not-package-secrets' })),
    /unknown or missing fields/
  );
});

test('renders a deployment entry and non-secret configuration module', () => {
  const configModule = renderConfigModule(devConfig());
  assert.match(configModule, /E2JWU1TLDA6YRS/);
  assert.doesNotMatch(configModule, /sessionSigningKey/);
  assert.match(renderEntryModule(), /exports\.handler = createDeploymentHandler\(config\)/);
});

test('stages only runtime sources and generated entry files', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-edge-package-'));
  const configPath = path.join(temporaryRoot, 'config.json');
  const outputPath = path.join(temporaryRoot, 'output');
  fs.writeFileSync(configPath, JSON.stringify(devConfig()), 'utf8');

  stagePackage({ configPath, outputPath, installDependencies: false });

  const files = fs.readdirSync(outputPath).sort();
  assert.deepEqual(files, [
    ...SOURCE_FILES,
    'deployment-config.cjs',
    'index.cjs'
  ].sort());
  assert.equal(files.some(file => file.endsWith('.test.cjs')), false);
  assert.match(fs.readFileSync(path.join(outputPath, 'index.cjs'), 'utf8'), /createDeploymentHandler/);
});

test('refuses to overwrite an existing output directory', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-edge-existing-'));
  const configPath = path.join(temporaryRoot, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(devConfig()), 'utf8');
  assert.throws(
    () => stagePackage({ configPath, outputPath: temporaryRoot, installDependencies: false }),
    /already exists/
  );
});

test('parses the required command-line arguments', () => {
  assert.deepEqual(parseArguments(['--config', 'config.json', '--output', '/tmp/package']), {
    config: 'config.json',
    output: '/tmp/package'
  });
  assert.throws(() => parseArguments(['--config', 'config.json']), /Usage/);
});
