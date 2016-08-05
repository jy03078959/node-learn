'use strict'
const debug = require('debug')('auth-api')
const crypto = require('crypto')
const config = require('config')
const Wechat = require('../service/wechat')
const db = require('../model')
const Err = require('../error')
// let module.exports = module.exports = {}
let authAPI = module.exports = {}

authAPI.loginOrRegister = function *() {
  let body = yield this.parseBody()
  let username = (body.username || '').toLowerCase().trim()
  let mobile = (body.mobile || '').replace(/\s+/g, '').replace(/^\+?86/, '')
  let password = body.password || ''
  if (username && !/^\w{6,20}$/.test(username)) throw new Err('invalid params', 'username')
  if (mobile && !/^[0-9]{11}$/.test(mobile)) throw new Err('invalid params', 'mobile')
  let cond = {}
  if (username) cond.username = username
  if (mobile) cond.mobile = mobile
  if (Object.keys(cond) === 0) throw new Err('invalid params', ['username', 'mobile'])
  let user = yield db.user.load(cond)
  if (!user) {
    user = {
      username: cond.username || md5(random(16)),
      mobile: cond.mobile || '',
      password: md5(config.password_salt, password),
      create_time: new Date(),
      activate: 1
    }
    yield db.user.insert(user)
  }

  if (user.password !== md5(config.password_salt, password)) throw new Err('no auth')

  return createAndReturnToken.call(this, user)
}

authAPI.wechatTicket = function *() {
  this.token
  let url = this.headers.referer
  debug('wechat-ticket', url)
  this.body = yield Wechat.getMpTicket(url)
}

authAPI.wechatLogin = function *() {
  let body = yield this.parseBody()
  let code = body.code
  let type = body.type

  if (Wechat.types.indexOf(type) === -1) throw new Err('invalid params', 'type')

  let wechat
  let wechatUserInfo
  try {
    wechat = new Wechat(type)
    yield wechat.getAccessToken(code)
    wechatUserInfo = yield wechat.getUserInfo()
  } catch (e) {
    console.log('wechat e.code:', e.code)
    if (e.code === 40029) throw new Err('invalid params', 'code')
    throw e
  }
  let unionid = wechat.unionid
  if (!unionid) throw new Err('no unionid', wechat)
  let user = yield db.user.load({wechat_union_id: unionid})
  if (!user) {
    user = {
      username: random(16),
      password: random(16),
      wechat_union_id: wechat.unionid,
      realname: wechatUserInfo.nickname,
      avatar: wechatUserInfo.headimgurl,
      create_time: new Date(),
      update_time: new Date(),
      activate: 1
    }
    if (wechat.type === 'public') user.wechat_mp_open_id = wechat.openid
    yield db.user.insert(user)
  } else {
    let userUpdate = {
      update_time: new Date()
    }
    if (!user.avatar) userUpdate.avatar = wechatUserInfo.headimgurl
    if (wechat.type === 'public') userUpdate.wechat_mp_open_id = wechat.openid
    yield db.user.update(user.id, userUpdate)
  }
  // let key = `WECHAT:TOKEN:${type}:${user.id}`
  // yield redis.setex(key, 2 * 3600, wechat.access_token)
  return createAndReturnToken.call(this, user)
}

function md5 (data) {
  return crypto.createHash('md5').update(data).digest('hex')
}

function random (length) {
  length = length || 16
  return crypto.randomBytes(length).toString('hex')
}

function createAndReturnToken (user) {
  let access_token = this.signToken({
    t: Date.now(),
    i: user.id,
    a: user.activate
  })
  this.cookies.set('PJ_SESSION', access_token)
  this.body = {
    access_token: 'Bearer ' + access_token
  }
  return access_token
}
