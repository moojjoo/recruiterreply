'use strict';

const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function deriveKey(secret, purpose) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('Invalid cookie encryption key');
  }
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from('recruiterreply-edge-cookie-v1', 'utf8'),
    Buffer.from(purpose, 'utf8'),
    KEY_BYTES
  );
}

function seal(plaintext, secret, purpose) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret, purpose), iv, {authTagLength: TAG_BYTES});
  cipher.setAAD(Buffer.from(purpose, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

function open(value, secret, purpose) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid sealed cookie');
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid sealed cookie');
  const [ivText, ciphertextText, tagText] = parts;
  const iv = Buffer.from(ivText, 'base64url');
  const ciphertext = Buffer.from(ciphertextText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) throw new Error('Invalid sealed cookie');
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(secret, purpose), iv, {authTagLength: TAG_BYTES});
  decipher.setAAD(Buffer.from(purpose, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {seal, open};
