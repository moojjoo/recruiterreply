'use strict';

const https = require('node:https');

function exchangeAuthorizationCode({
  domain,
  approvedDomain,
  clientId,
  approvedClientId,
  redirectUri,
  approvedRedirectUri,
  code,
  verifier
}) {
  if (
    typeof domain !== 'string' ||
    domain !== approvedDomain ||
    !/^[a-z0-9-]+\.auth\.us-east-1\.amazoncognito\.com$/.test(domain) ||
    typeof clientId !== 'string' ||
    clientId !== approvedClientId ||
    typeof redirectUri !== 'string' ||
    redirectUri !== approvedRedirectUri ||
    !/^https:\/\/(dev|test)\.recruiterreply\.com\/_auth\/callback$/.test(redirectUri) ||
    typeof code !== 'string' ||
    !/^[A-Za-z0-9._~-]{1,2048}$/.test(code) ||
    typeof verifier !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)
  ) {
    return Promise.reject(new Error('Untrusted OAuth token exchange configuration'));
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  }).toString();

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: domain,
      path: '/oauth2/token',
      method: 'POST',
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let data = '';
      let bytes = 0;

      response.on('data', chunk => {
        bytes += chunk.length;

        if (bytes > 65536) {
          response.destroy(new Error('OAuth token response too large'));
          return;
        }

        data += chunk.toString('utf8');
      });

      response.on('error', reject);

      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error('OAuth token exchange failed'));
          return;
        }

        try {
          const tokens = JSON.parse(data);

          if (
            typeof tokens.id_token !== 'string' ||
            typeof tokens.access_token !== 'string'
          ) {
            throw new Error('Invalid OAuth token response');
          }

          resolve(tokens);
        } catch {
          reject(new Error('Invalid OAuth token response'));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('OAuth token exchange timed out'));
    });

    request.on('error', reject);
    request.end(body);
  });
}

module.exports = { exchangeAuthorizationCode };
