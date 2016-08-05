'use strict'

const redis = require('./redis')
const speakeasy = require('speakeasy')
const yunpian = require('./yunpian')
const TOKEN_SALT = 'mobile'
const TOKEN_EXPIRE_SECONDS = 15 * 60
const MOBILE_LOCK_SECONDS = 60
// const MOBILE_EXPIRE_SECONDS = 86400
// const MOBILE_COUNT = 5

// module.exports.check = check
module.exports.lock = lock
function * lock (mobile) {
  let key = `SMS:MOBILE_LOCK:${mobile}`
  let count = yield redis.setnx(key, 1)
  console.log(count)
  if (count !== 1) throw new Error('already sent')
  yield redis.expire(key, MOBILE_LOCK_SECONDS)
}

// function * check (mobile) {
//   let key = `SMS:MOBILE_COUNT:${mobile}`
//   let count
//   count = yield redis.get(key)
//   if (count && count > MOBILE_COUNT) return false

//   return true
// }

module.exports.generateToken = generateToken
function generateToken (mobile) {
  return speakeasy.totp({
    step: TOKEN_EXPIRE_SECONDS,
    epoch: Date.now(),
    secret: TOKEN_SALT + mobile,
    encoding: 'base32'
  })
}

function * storeToken (mobile, token) {
  let key = `SMS:MOBILE:${mobile}`
  yield redis.setex(key, TOKEN_EXPIRE_SECONDS, token)
}

module.exports.send = sendSmsVerifyCode
module.exports.sendSmsVerifyCode = sendSmsVerifyCode
function * sendSmsVerifyCode (mobile) {
  yield lock(mobile)
  let token = generateToken(mobile)
  yield storeToken(mobile, token)
  let text = `您的验证码为${token}, 请在15分钟内输入验证码`
  yield yunpian.send(mobile, text)
}

module.exports.verifyToken = verifyToken
module.exports.verify = verifyToken
function * verifyToken (mobile, token) {
  let key = `SMS:MOBILE:${mobile}`
  let localToken = yield redis.get(key)
  if (localToken && localToken === token) {
    return true
  }
  return false
}

// module.exports.sendText = yunpian.sendText
// module.exports.send = yunpian.send
