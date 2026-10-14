'use strict';

const { verifySessionCookie } = require('./session-cookie.cjs');

function createSessionGateway(trustedEnvironments) {
  return async function validateSession(request, distributionId) {
    const environment = trustedEnvironments?.[distributionId];
    if (!environment) return false;

    const approved = environment.approvedIdentity;
    const config = environment.sessionConfig;
    const hasInjectedSecret = typeof environment.sessionSecret === 'string';
    const hasKeyProvider = typeof environment.getSigningKeys === 'function';

    if (
      !approved ||
      !config ||
      typeof approved.issuer !== 'string' ||
      typeof approved.clientId !== 'string' ||
      config.issuer !== approved.issuer ||
      config.clientId !== approved.clientId ||
      hasInjectedSecret === hasKeyProvider
    ) {
      return false;
    }

    let secret = environment.sessionSecret;
    if (hasKeyProvider) {
      try {
        const keys = await environment.getSigningKeys();
        secret = keys?.sessionSigningKey;
      } catch {
        return false;
      }
    }

    if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
      return false;
    }

    const cookies = request.headers?.cookie;
    if (!Array.isArray(cookies) || cookies.length !== 1) return false;

    const values = cookies[0]?.value?.split(';').map(v => v.trim()) || [];
    const sessions = values.filter(v => v.startsWith('rr_session='));

    if (sessions.length !== 1) return false;

    const session = sessions[0].slice('rr_session='.length);
    if (!session) return false;

    try {
      verifySessionCookie(
        session,
        secret,
        {
          issuer: approved.issuer,
          clientId: approved.clientId
        }
      );
      return true;
    } catch {
      return false;
    }
  };
}

module.exports = { createSessionGateway };
