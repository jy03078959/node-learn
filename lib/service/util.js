'use strict'

const jws = require('jws')
let U = module.exports = {}

U.signToken = function (payload, secretToken, options) {
  options = options || {}

  var header = {typ: 'JWT', alg: options.algorithm || 'HS256'}
  return jws.sign({
    header: header,
    payload: payload,
    secret: secretToken
  })
}
