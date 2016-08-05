'use strict'

const crypto = require('crypto')
const config = require('config')
const moment = require('moment')
const urllib = require('urllib')
const types = ['app', 'public', 'web']
const redis = require('./redis')

function Wechat (type) {
  if (!(this instanceof Wechat)) return new Wechat(type)
  type = type.toLowerCase()
  if (types.indexOf(type) === -1) throw new Error('not invalid wechat type')
  this.type = type
}
Wechat.types = types
module.exports = Wechat

function getConfig (type) {
  return config.wechat[type]
}

function * request (url, options) {
  options = options || {}
  options.dataType = options.dataType || 'json'
  options.contentType = options.contentType || 'json'
  let result = yield urllib.request(url, options)
  let data = result.data
  if (!data) {
    throw new Error('wechat api failed')
  }

  if (data.errcode) {
    let err = new Error(data.errmsg)
    err.data = data
    err.code = data.errcode
    throw err
  }

  return data
}

Wechat.prototype.getUserInfo = function * () {
  if (!this.access_token || !this.openid) throw new Error('no access_token or no openid')
  let url = `https://api.weixin.qq.com/sns/userinfo?access_token=${this.access_token}&openid=${this.openid}&lang=zh_CN`
  let result = yield request(url)
  this.unionid = result.unionid
  return result
}

Wechat.prototype.getAccessToken = function * (code) {
  let url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${getConfig(this.type).app_id}&secret=${getConfig(this.type).app_secret}&code=${code}&grant_type=authorization_code`
  let result = yield request(url)
  this.access_token = result.access_token
  this.openid = result.openid
  return result
  // {
  //   "access_token":"ACCESS_TOKEN",
  //   "expires_in":7200,
  //   "refresh_token":"REFRESH_TOKEN",
  //   "openid":"OPENID",
  //   "scope":"SCOPE"
  // }
}

Wechat.prototype.refreshToken = function * (refreshToken) {
  let url = `https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${getConfig(this.type).app_id}&grant_type=refresh_token&refresh_token=${refreshToken}`
  let result = yield request(url)
  this.access_token = result.access_token
  this.openid = result.openid
  this.scope = result.scope
  return result
  // {
  //   "access_token":"ACCESS_TOKEN",
  //   "expires_in":7200,
  //   "refresh_token":"REFRESH_TOKEN",
  //   "openid":"OPENID",
  //   "scope":"SCOPE"
  // }
}

// module.exports.check https://api.weixin.qq.com/sns/auth?access_token=ACCESS_TOKEN&openid=OPENID

Wechat.getMpAccessToken = getMpAccessToken
function * getMpAccessToken () {
  let access_token = yield redis.get('WECHAT:MP:ACCESS_TOKEN')
  if (!access_token) {
    let url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${getConfig('public').app_id}&secret=${getConfig('public').app_secret}`
    let result = yield request(url)
    access_token = result.access_token
    yield redis.setex('WECHAT:MP:ACCESS_TOKEN', 7200 - 50, access_token)
  }
  return access_token
}

Wechat.sendMessage = function *(user, messageUrl, title, content, suggest, remark, time, options) {
  options = options || {}
  time = time || new Date()
  time = options.onlyDate ? moment(time).format('YYYY年MM月DD日') : moment(time).format('YYYY年MM月DD日 HH:mm')
  let access_token = yield getMpAccessToken()
  let template_id = getConfig('public').template_id
  let data = {
    'touser': user.wechat_mp_open_id,
    'template_id': template_id,
    'url': messageUrl,
    // 'topcolor': '#FF0000',
    'data': {
      first: { value: title || '' },
      keyword1: { value: time },
      keyword2: { value: content || '' },
      keyword3: { value: suggest || '' },
      remark: { value: remark || '' }
    }
  }
  let url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${access_token}`
  let response = yield request(url, {data: data, method: 'POST'})
  return response
}

Wechat.getMpTicket = function *(url) {
  let ticket = yield redis.get('WECHAT:MP:TICKET')
  if (!ticket) {
    let resp = yield getMpTicket()
    ticket = resp.ticket
    yield redis.setex('WECHAT:MP:TICKET', 7200 - 50, ticket)
  }
  let timestamp = Math.round(Date.now() / 1000)
  let noncestr = createRandomStr()
  let signature = crypto.createHash('sha1').update(
    `jsapi_ticket=${ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${url}`
  ).digest('hex')
  return {
    ticket: ticket,
    noncestr: noncestr,
    timestamp: timestamp,
    signature: signature
  }
}

function * getMpTicket () {
  let access_token = yield getMpAccessToken()
  let url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`
  let result = yield request(url)
  return result
  // {
  //   "errcode":0,
  //   "errmsg":"ok",
  //   "ticket":"bxLdikRXVbTPdHSM05e5u5sUoXNKd8-41ZO3MhKoyN5OfkWITDGgnr2fwJ0m9E8NYzWKVZvdVtaUgWvsdshFKA",
  //   "expires_in":7200
  // }
}

function createRandomStr (length) {
  length = length || 16
  return crypto.randomBytes(length).toString('hex')
}
