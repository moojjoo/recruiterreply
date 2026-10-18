'use strict';

const crypto = require('node:crypto');

function createOriginSignature({ method, uri, querystring = '', timestamp, secret }) {
  if (
    typeof method !== 'string' ||
    typeof uri !== 'string' ||
    typeof querystring !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32
  ) {
    throw new Error('Invalid origin-signature input');
  }

  const canonical = `${timestamp}\n${method}\n${uri}\n${querystring}`;
  return crypto.createHmac('sha256', secret).update(canonical).digest('base64url');
}

module.exports = { createOriginSignature };
