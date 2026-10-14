'use strict';

const {
  generatePkce,
  generateOAuthState,
  generateNonce
} = require('./oauth-pkce.cjs');

function createAuthorizationRequest(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Missing OAuth configuration');
  }

  const { domain, clientId, redirectUri, approvedIdentity } = config;

  if (
    typeof domain !== 'string' ||
    !/^[a-z0-9-]+\.auth\.us-east-1\.amazoncognito\.com$/.test(domain) ||
    typeof clientId !== 'string' ||
    !/^[A-Za-z0-9]+$/.test(clientId) ||
    typeof redirectUri !== 'string' ||
    !/^https:\/\/(dev|test)\.recruiterreply\.com\/_auth\/callback$/.test(redirectUri) ||
    !approvedIdentity ||
    domain !== approvedIdentity.domain ||
    clientId !== approvedIdentity.clientId ||
    redirectUri !== approvedIdentity.redirectUri
  ) {
    throw new Error('Untrusted OAuth configuration');
  }

  const pkce = generatePkce();
  const state = generateOAuthState();
  const nonce = generateNonce();

  const url = new URL(`https://${domain}/oauth2/authorize`);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return {
    authorizationUrl: url.toString(),
    transaction: {
      verifier: pkce.verifier,
      state,
      nonce,
      redirectUri,
      createdAt: Date.now()
    }
  };
}

module.exports = { createAuthorizationRequest };
