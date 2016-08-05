'use strict'

const fs = require('fs')
const moment = require('moment')
const thunk = require('thunks')()
const db = require('../model')
const Err = require('../error')
const fetchEmail = require('../service/fetch_email')
const parseExcelBuffer = require('../service/parseExcel2').parseExcelBuffer
const importList = require('../service/importList')
const Wechat = require('../service/wechat')
const logic = require('../service/logic')
const mailer = require('../service/mailer')

let emailAPI = module.exports = {}
emailAPI.list = function *() {
  let token = this.token
  let emails = yield db.email.find({user_id: token.i, delete_status: db.email.DELETE_STATUS_TYPE.NO})
  let result = emails.map(function (email) {
    return {
      email: email.email,
      status: email.status,
      fetch_time: email.fetch_time.toISOString(),
      create_time: email.create_time.toISOString(),
      update_time: email.update_time.toISOString(),
      extra: email.extra || {}
    }
  })
  this.body = result
}

emailAPI.fetchEmail = function *() {
  let token = this.token
  let email = this.params.email || this.query.email
  if (!email) throw new Err('invalid params', 'email')
  let emailInfo = yield db.email.load({
    user_id: token.i,
    email: email,
    delete_status: db.email.DELETE_STATUS_TYPE.NO
  })

  let inbox
  try {
    inbox = yield fetchEmail.initFetch(emailInfo)
  } catch (e) {
    throw e
  }

  thunk(fetchEmail.fetchEmail(emailInfo, inbox))(function (err) {
    if (err) console.log('first try import mailbox', err)
  })
}

emailAPI.createAndUpdateEmail = function *() {
  let token = this.token
  let body = yield this.parseBody()
  let email = this.params.email || body.email

  if (!email || !body.password) throw new Err('invalid params', ['email', 'password'])
  let emailInfo = yield db.email.load({
    user_id: token.i,
    email: email,
    delete_status: db.email.DELETE_STATUS_TYPE.NO
  })
  if (!emailInfo) emailInfo = {}

  let extra = emailInfo.extra || {}
  extra.tls = body.tls !== false
  extra.imapHost = body.imapHost || ''
  extra.imapPort = Number(body.imapPort) || 0
  extra.inbox = body.mailbox || 'INBOX'

  emailInfo.user_id = token.i
  emailInfo.email = email
  emailInfo.password = body.password
  emailInfo.status = db.email.STATUS_TYPE.NORMAL
  emailInfo.update_time = new Date()
  emailInfo.extra = extra

  if (emailInfo.id) {
    yield db.email.update(emailInfo.id, emailInfo)
  } else {
    emailInfo.create_time = new Date()
    yield db.email.insert(emailInfo)
  }

  let inbox
  try {
    inbox = yield fetchEmail.initFetch(emailInfo)
  } catch (e) {
    throw new Err('invalid params', ['email', 'password'])
  }
  this.body = emailInfo

  thunk(fetchEmail.fetchEmail(emailInfo, inbox))(function (err) {
    if (err) console.log('first try import mailbox', err)
  })
}

emailAPI.deleteEmail = function *() {
  let token = this.token
  let email = this.params.email
  let emailInfo = yield db.email.load({
    user_id: token.i,
    email: email,
    delete_status: db.email.DELETE_STATUS_TYPE.NO
  })
  if (!emailInfo) throw new Err('not found', 'email')
  yield db.email.update(emailInfo.id, {delete_status: db.email.DELETE_STATUS_TYPE.YES})
  this.body = {}
}

emailAPI.notify = function *() {
  let body = yield this.parseBody()

  // TODO: verify request
  if (!mailer.verify(body)) throw new Err('no auth')

  let messageUrl = body['message-url']
  if (!messageUrl) throw new Err('invalid params', 'message-url')
  let recipient = body.recipient || ''
  if (!recipient) throw new Err('invalid params', 'recipient')
  let mobile = recipient.split('@')[0] || ''
  if (!/^1\d{10}$/.test(mobile)) throw new Err('no email receipt')

  let user = yield db.user.load({mobile: mobile})
  if (!user) throw new Err('no email receipt')
  thunk(receiveEmailContent(user, body))((err) => {
    if (err) console.error(err)
  })
  this.body = {}
}

function * receiveEmailContent (user, body) {
  // console.log(body.attachments, !body.attachments, Array.isArray(body.attachments))
  let attachments = JSON.parse(body.attachments)
  if (!attachments || !Array.isArray(attachments)) throw new Err('email attachment error')
  for (let i in attachments) {
    let attachment = attachments[i]
    // TODO: check extname: attachment.name
    // TODO: check filesize: attachment.size
    let retry = 20
    let resp
    while (retry-- > 0) {
      try {
        resp = yield mailer.fetch(attachment.url)
        break
      } catch (e) {
        if (retry <= 0) {
          console.log('reach max retry')
          console.log(e)
          return
        }
      }
    }

    try {
      fs.writeFile('/tmp/' + moment().format('YYYY-MM-DD-HH:mm:SSS') + '.xlsx', resp.data)
      let fileData = yield parseExcelBuffer(resp.data)
      for (let j in fileData) {
        let list = yield importList(user.id, fileData[j], {
          filename: `${attachment.name}[${j}]`,
          target: body.from,
          subject: body.subject,
          date: new Date(body.Date),
          iotype: 'in'
        })

        let content = logic.makeWechatContent(list)
        yield Wechat.sendMessage(
          user,
          `http://open.weixin.qq.com/connect/oauth2/authorize?appid=wx07c7271a9f713a3c&redirect_uri=https%3A%2F%2F5443.funpj.com%2Fwebclient%2Findex.html%23%2Ftrade%2Fwaitbill&response_type=code&scope=snsapi_userinfo&state=123`,
          `您收到一份${body.from}发来的交易清单，请处理`,
          content,
          '点击立即处理，确认交易后，可体验极速合同生成服务',
          ''
        )
      }
    } catch (e) {
      console.error(e, e.stack)
      continue
    }
  }
}
