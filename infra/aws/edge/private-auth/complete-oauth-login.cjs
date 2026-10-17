'use strict';

const { validateOAuthCallback } = require('./oauth-callback.cjs');
const { exchangeAuthorizationCode } = require('./oauth-token-exchange.cjs');
const { fetchJwks } = require('./fetch-jwks.cjs');
const { validateOAuthTokens } = require('./validate-oauth-tokens.cjs');
const {
  createSessionCookie,
  clearSessionCookie
} = require('./session-cookie.cjs');
const { clearTransactionCookie } = require('./oauth-transaction.cjs');
const { consumeOAuthTransaction } = require('./oauth-replay-guard.cjs');

async function completeOAuthLogin({
  query,
  transactionCookie,
  transactionSecret,
  sessionSecret,
  environment,
  now = Date.now(),
  exchangeCode = exchangeAuthorizationCode,
  retrieveJwks = fetchJwks,
  replayStore
}) {
  if (
    !environment ||
    !environment.approvedIdentity ||
    !environment.oauth ||
    !environment.tokenConfig ||
    !environment.sessionConfig
  ) {
    throw new Error('Missing approved OAuth environment configuration');
  }

  const { oauth, tokenConfig, sessionConfig, approvedIdentity } = environment;

  if (
    oauth.domain !== approvedIdentity.domain ||
    oauth.clientId !== approvedIdentity.clientId ||
    oauth.redirectUri !== approvedIdentity.redirectUri ||
    tokenConfig.issuer !== approvedIdentity.issuer ||
    tokenConfig.clientId !== approvedIdentity.clientId ||
    sessionConfig.issuer !== approvedIdentity.issuer ||
    sessionConfig.clientId !== approvedIdentity.clientId
  ) {
    throw new Error('OAuth environment identity mismatch');
  }

  const callback = validateOAuthCallback({
    query,
    transactionCookie,
    transactionSecret,
    expectedRedirectUri: approvedIdentity.redirectUri,
    now
  });

  await consumeOAuthTransaction(query.state, replayStore);

  const tokens = await exchangeCode({
    ...oauth,
    approvedDomain: approvedIdentity.domain,
    approvedClientId: approvedIdentity.clientId,
    approvedRedirectUri: approvedIdentity.redirectUri,
    code: callback.code,
    verifier: callback.verifier
  });

  if (!tokens || typeof tokens.id_token !== 'string') {
    throw new Error('Missing ID token');
  }

  const jwks = await retrieveJwks(tokenConfig.issuer, {
    trustedIssuer: approvedIdentity.issuer
  });

  const claims = validateOAuthTokens({
    idToken: tokens.id_token,
    jwks,
    config: tokenConfig,
    expectedNonce: callback.nonce,
    now: Math.floor(now / 1000)
  });

  const session = createSessionCookie({
    subject: claims.sub,
    issuer: sessionConfig.issuer,
    clientId: sessionConfig.clientId
  }, sessionSecret, now);

  return {
    sessionCookie: session.header,
    clearTransactionCookie: clearTransactionCookie(),
    expiresIn: 900
  };
}

module.exports = { completeOAuthLogin };
