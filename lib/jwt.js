'use strict';

var uuid = require('uuid');
var crypto = require('crypto');
var ecdsaSigFormatter = require('ecdsa-sig-formatter');
var enums = require('./enums');
var errors = require('./errors');
var helpers = require('./helpers');
var JwtHeader = require('./jwt-header');
var JwtBody = require('./jwt-body');

function Jwt(claims, enforceDefaultFields) {
  if (!(this instanceof Jwt)) {
    return new Jwt(claims, enforceDefaultFields);
  }

  this.header = new JwtHeader();
  this.body = new JwtBody(claims);

  if (enforceDefaultFields !== false) {
    this.setSigningAlgorithm('none');

    if (!this.body.jti) {
      this.setJti(uuid.v4());
    }

    if (!this.body.iat) {
      this.setIssuedAt(helpers.nowEpochSeconds());
    }
  }
}

Jwt.prototype.setJti = function setJti(jti) {
  this.body.jti = jti;
  return this;
};

Jwt.prototype.setSubject = function setSubject(sub) {
  this.body.sub = sub;
  return this;
};

Jwt.prototype.setIssuer = function setIssuer(iss) {
  this.body.iss = iss;
  return this;
};

Jwt.prototype.setIssuedAt = function setIssuedAt(iat) {
  this.body.iat = iat;
  return this;
};

Jwt.prototype.setExpiration = function setExpiration(exp) {
  if (exp) {
    this.body.exp = Math.floor((exp instanceof Date ? exp : new Date(exp)).getTime() / 1000);
  } else {
    delete this.body.exp;
  }

  return this;
};

Jwt.prototype.setNotBefore = function setNotBefore(nbf) {
  if (nbf) {
    this.body.nbf = Math.floor((nbf instanceof Date ? nbf : new Date(nbf)).getTime() / 1000);
  } else {
    delete this.body.nbf;
  }

  return this;
};

Jwt.prototype.setSigningKey = function setSigningKey(key) {
  this.signingKey = key;
  return this;
};

Jwt.prototype.setSigningAlgorithm = function setSigningAlgorithm(alg) {
  if (!helpers.isSupportedAlg(alg)) {
    throw new errors.UnsupportedSigningAlgorithmJwtError();
  }

  this.header.alg = alg;

  return this;
};

Jwt.prototype.sign = function sign(payload, algorithm, cryptoInput) {
  var buffer;
  var signature;
  var cryptoAlgName = enums.algCryptoMap[algorithm];
  var signingType = enums.algTypeMap[algorithm];

  if (!cryptoAlgName) {
    throw new errors.UnsupportedSigningAlgorithmJwtError();
  }

  if (signingType === 'hmac') {
    buffer = crypto.createHmac(cryptoAlgName, cryptoInput).update(payload).digest();
  } else {
    buffer = crypto.createSign(cryptoAlgName).update(payload).sign(cryptoInput);
  }

  if (helpers.isECDSA(algorithm)) {
    signature = ecdsaSigFormatter.derToJose(buffer, algorithm);
  } else {
    signature = helpers.base64urlEncode(buffer);
  }

  return signature;
};

Jwt.prototype.isSupportedAlg = helpers.isSupportedAlg;

Jwt.prototype.compact = function compact() {
  var segments = [];

  segments.push(this.header.compact());
  segments.push(this.body.compact());

  if (this.header.alg !== 'none') {
    if (!this.signingKey) {
      throw new errors.SigningKeyRequiredJwtError();
    }

    this.signature = this.sign(segments.join('.'), this.header.alg, this.signingKey);

    segments.push(this.signature);
  }

  return segments.join('.');
};

Jwt.prototype.toString = function toString() {
  return this.compact();
};

Jwt.prototype.isExpired = function isExpired() {
  return new Date(this.body.exp * 1000) < new Date();
};

Jwt.prototype.isNotBefore = function isNotBefore() {
  return new Date(this.body.nbf * 1000) >= new Date();
};

module.exports = Jwt;