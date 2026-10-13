'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {test} = require('node:test');
const {validateIdToken} = require('./verify-id-token.cjs');

const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = publicKey.export({format: 'jwk'});
Object.assign(jwk, {kid:'test-key', use:'sig', alg:'RS256'});
const jwks = {keys:[jwk]};
const config = {issuer:'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV', clientId:'dev-client'};
const now = 1800000000;
function token(overrides={}, headerOverrides={}) {
  const h = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-key',...headerOverrides})).toString('base64url');
  const p = Buffer.from(JSON.stringify({iss:config.issuer,aud:config.clientId,token_use:'id',sub:'person-1',email_verified:true,iat:now-10,exp:now+600,...overrides})).toString('base64url');
  const body = h+'.'+p;
  return body+'.'+crypto.sign('RSA-SHA256', Buffer.from(body),privateKey).toString('base64url');
}
test('valid signed ID token is accepted',()=>assert.equal(validateIdToken(token(),jwks,config,now).sub,'person-1'));
test('wrong audience rejected',()=>assert.throws(()=>validateIdToken(token({aud:'test-client'}),jwks,config,now)));
test('wrong environment issuer rejected',()=>assert.throws(()=>validateIdToken(token({iss:'https://other'}),jwks,config,now)));
test('access token rejected',()=>assert.throws(()=>validateIdToken(token({token_use:'access'}),jwks,config,now)));
test('expired token rejected',()=>assert.throws(()=>validateIdToken(token({exp:now}),jwks,config,now)));
test('unverified email rejected',()=>assert.throws(()=>validateIdToken(token({email_verified:false}),jwks,config,now)));
test('future token rejected',()=>assert.throws(()=>validateIdToken(token({iat:now+120}),jwks,config,now)));
test('unsigned algorithm rejected',()=>assert.throws(()=>validateIdToken(token({}, {alg:'none'}),jwks,config,now)));
test('wrong signing key rejected',()=>assert.throws(()=>validateIdToken(token(),{keys:[]},config,now)));
test('modified signature rejected',()=>{
  const t=token();const parts=t.split('.');parts[2]='A'+parts[2].slice(1);
  assert.throws(()=>validateIdToken(parts.join('.'),jwks,config,now));
});
test('malformed JWT rejected',()=>assert.throws(()=>validateIdToken('not-a-jwt',jwks,config,now)));
