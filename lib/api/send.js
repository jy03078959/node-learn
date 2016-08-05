'use strict'

const _ = require('lodash')
const thunk = require('thunks')()
const db = require('../model')
const Err = require('../error')
const mailer = require('../service/mailer')
const writeExcel = require('../service/writeExcel')
const moment = require('moment')
const config = require('config')
const crypto = require('crypto')
const path = require('path')
const redis = require('../service/redis')
const Wechat = require('../service/wechat')
const logic = require('../service/logic')

let sendAPI = module.exports = {}

sendAPI.getPreivewLink = function *() {
  let token = this.token
  let body = yield this.parseBody()
  let list_id = body.list_id

  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('invalid params', 'list')

  let previewLink = yield makePreviewLink(list)
  this.body = previewLink
}

sendAPI.previewList = function *() {
  // console.log('list-token', this.params.listToken)
  let key = `PREVIEW:${this.params.listToken}`
  let list_id = yield redis.get(key)
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({id: list_id})
  if (!list) throw new Err('not found', 'list')
  delete list.id
  delete list.user_id
  this.body = list
}

sendAPI.savePreviewList = function *() {
  let token = this.token
  let key = `PREVIEW:${this.params.listToken}`
  let list_id = yield redis.get(key)
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({id: list_id})
  if (!list) throw new Err('not found', 'list')

  let newList = yield db.list.load({origin_list_id: list.id, user_id: token.i})
  if (newList) throw new Err('list imported')

  let originUser = yield db.user.load({id: list.user_id})
  newList = _.assign({}, list)
  newList.origin_list_id = list.id
  newList.user_id = token.i
  newList.status = db.list.STATUS_TYPE.DRAFT
  newList.extra.io = 'in'
  newList.extra.emailInfo = _.assign({}, list.extra.emailInfo, {
    target: `${originUser.realname} <${originUser.mobile}@funpj.com>`,
    date: new Date().toString()
  })
  delete newList.id
  yield db.list.insert(newList)
  let listBills = yield db.listbill.find({list_id: list.id})
  yield listBills.map(function (listbill) {
    let newListBill = _.assign({}, listbill)
    delete newListBill.id
    newListBill.user_id = token.i
    newListBill.list_id = newList.id
    return db.listbill.insert.bind(db.listbill)(newListBill)
  })

  this.body = newList
}

sendAPI.send = function *() {
  let token = this.token
  let body = yield this.parseBody()
  let list_id = body.list_id
  let title = body.title || 'Funpj SendList Sample Title'
  let content = body.content || 'Funpj SendList Sample Content'
  let contact_id = body.contact_id
  let email = body.email

  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('invalid params', 'list')

  let contact
  if (contact_id) {
    contact = yield db.contact.load({id: contact_id})
    if (!contact || (contact.type !== db.contact.TYPE_TYPE.PUBLIC && contact.user_id !== token.i)) {
      throw new Err('invalid params', 'contact')
    }
  } else if (email) {
    contact = { user_id: token.i, email: email, type: db.contact.TYPE_TYPE.PRIVATE }
    yield db.contact.insert(contact)
  } else {
    throw new Err('invalid params', ['contact_id', 'email'])
  }

  let user = yield db.user.load({id: token.i})
  if (!user.mobile) throw new Err('invalid params', 'user mobile')

  if (contact.app_user_id) {
    // TODO: app user send in app
    let target_user = yield db.user.load({id: contact.app_user_id})
    if (!target_user) throw new Err('invalid params', 'user')
    let newList = _.assign({}, list)
    delete newList.id
    newList.user_id = target_user.id
    newList.status = db.list.STATUS_TYPE.DRAFT
    yield db.list.insert(newList)
    let listBills = yield db.listbill.find({list_id: list.id})
    yield thunk.all(listBills.map(function (listbill) {
      let newListBill = _.assign({}, listbill)
      delete newListBill.id
      newListBill.user_id = target_user.id
      newListBill.list_id = newList.id
      return db.listbill.insert.bind(db.listbill)(newListBill)
    }))

    let content = logic.makeWechatContent(list)
    yield Wechat.sendMessage(
      target_user,
      `http://open.weixin.qq.com/connect/oauth2/authorize?appid=wx07c7271a9f713a3c&redirect_uri=https%3A%2F%2F5443.funpj.com%2Fwebclient%2Findex.html%23%2Ftrade%2Fwaitbill&response_type=code&scope=snsapi_userinfo&state=123`,
      `您收到一份${user.realname}<${user.mobile}@funpj.com>发来的交易清单，请处理`,
      content,
      '点击立即处理，确认交易后，可体验极速合同生成服务',
      ''
    )
  }

  // TODO: app user notification
  if (contact.email) {
    let listBills = yield db.listbill.findWithBill({list_id: list.id})
    let buffer = writeExcel(list, listBills)
    let filename = title
    yield mailer.send2({
      from: `${user.mobile}@funpj.com`,
      to: contact.email,
      title: title,
      content: content,
      attachments: [{
        stream: buffer,
        filename: `${filename}.xlsx`
      }]
    })
  }

  this.body = {}
}

function * makePreviewLink (list) {
  let listToken = nonce()
  let key = `PREVIEW:${listToken}`
  yield redis.setex(key, 86400, list.id)
  let url = config.host + path.join(config.rootAPI, '/preview/', listToken)
  return {
    token: listToken,
    url: url
  }
}

function nonce () {
  return crypto.randomBytes(16).toString('hex')
}
