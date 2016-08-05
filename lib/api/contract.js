'use strict'

const crypto = require('crypto')
const path = require('path')
const config = require('config')
const moment = require('moment')
const db = require('../model')
const mailer = require('../service/mailer')
const writeExcel = require('../service/writeExcel')
const redis = require('../service/redis')
const getContractStream = require('../service/gendoc')
const Err = require('../error')

let contractAPI = {}
module.exports = contractAPI
contractAPI.send = function *() {
  let sendType = this.params.sendType
  let token = this.token
  let list_id = this.params.list_id
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('invalid params', 'list')
  let contract = yield db.contract.load({user_id: token.i, list_id: list.id}, {
    sort: 'create_time DESC'
  })
  if (!contract) throw new Err('invalid params', 'contract')
  if (sendType === 'send') {
    return yield sendEmail.call(this, list, contract)
  } else if (sendType === 'downloadUrl') {
    return yield makePreviewLink.call(this, list, contract)
  }
}

contractAPI.download = function *() {
  let key = `PREVIEW:${this.params.contractToken}`
  let contract_id = yield redis.get(key)
  if (!contract_id) throw new Err('invalid params', 'contract_id')
  let contract = yield db.contract.load({id: contract_id})
  if (!contract) throw new Err('not found', 'contract')

  let list = yield db.list.load({id: contract.list_id})
  if (!list) throw new Err('invalid params', 'list')

  let date = moment().format('YYYY-MM-DD')
  let filename = `${date}-${list.target_name}`
  let docStream = yield getContractStream(contract)
  this.set('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  // this.set('content-disposition', `attachment; filename=" + ${filename});`)
  this.body = docStream
}

function * makePreviewLink (list, contract) {
  let contractToken = nonce()
  let key = `PREVIEW:${contractToken}`
  yield redis.setex(key, 86400 * 2, contract.id)
  let url = config.host + path.join(config.rootAPI, '/contract/download/', contractToken)
  this.body = {
    token: contractToken,
    url: url
  }
}

function * sendEmail (list, contract) {
  let token = this.token
  let user = yield db.user.load({id: token.i})

  let body = yield this.parseBody() || {}
  let email = body.email
  if (!email) throw new Err('invalid params', 'email')

  // TODO saned to email
  let title = body.title || 'Funpj Contract Sample Title'
  let content = body.content || 'Funpj Contract Sample Content'

  let listBills = yield db.listbill.findWithBill({list_id: list.id})
  let listBuffer = writeExcel(list, listBills)
  // let date = moment(list.transaction_date).format('YYYY-MM-DD')
  let filename = title
  let docStream = yield getContractStream(contract)
  yield mailer.send({
    from: `${user.mobile}@funpj.com`,
    to: email,
    title: title,
    content: content,
    attachments: [{
      stream: listBuffer,
      filename: `${filename}.xlsx`
    }, {
      stream: docStream,
      filename: `${filename}-合同.docx`
    }]
  })

  this.body = {}
}

contractAPI.findByList = function *() {
  let token = this.token

  let list_id = this.params.list_id
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('invalid params', 'list')
  let contract = yield db.contract.load({user_id: token.i, list_id: list.id}, {
    sort: 'create_time DESC'
  })
  if (!contract) throw new Err('not found', 'contract')
  this.body = contract
}

contractAPI.create = function *() {
  let token = this.token
  let body = yield this.parseBody()

  let list_id = this.params.list_id
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('invalid params', 'list')

  let contract = {
    create_time: new Date(),
    update_time: new Date(),
    user_id: token.i,
    list_id: list.id,
    extra: {
      buyer: body.buyer,
      saler: body.saler
    }
  }

  yield db.contract.insert(contract)

  // TODO save bank info
  let saler = body.saler
  if (saler && saler.name) yield saveBank(saler)
  let buyer = body.buyer
  if (buyer && buyer.name) yield saveBank(buyer)

  this.body = contract

  /* {
    list.id
    saler: {
      name: "xxx",
      account_name: "xxx",
      account_number: "xxx",
      bank_name: "xxx",
      bank_number: "xxx"
    }
    buyer: {
      name: "xxx",
      account_name: "xxx",
      account_number: "xxx",
      bank_name: "xxx",
      bank_number: "xxx"
    }
  } */
}

contractAPI.findBank = function *() {
  this.token
  let name = this.query.name || ''
  let banks = yield db.bank.find({
    'name$like': name
  }, {
    sort: 'rate DESC, create_time DESC'
  })
  this.body = banks
  // by name
}

function * saveBank (bankInfo) {
  let bank = yield db.bank.load({
    name: bankInfo.name || '',
    bank_name: bankInfo.bank_name || '',
    bank_number: bankInfo.bank_number || '',
    account_name: bankInfo.account_name || '',
    account_number: bankInfo.account_number || ''
  }, {
    sort: 'rate DESC, create_time DESC'
  })
  if (bank) {
    yield db.bank.update(bank.id, {rate: bank.rate + 1})
  } else {
    bank = {
      name: bankInfo.name || '',
      bank_name: bankInfo.bank_name || '',
      bank_number: bankInfo.bank_number || '',
      account_name: bankInfo.account_name || '',
      account_number: bankInfo.account_number || '',
      create_time: new Date(),
      update_time: new Date()
    }
    yield db.bank.insert(bank)
  }
}

function nonce () {
  return crypto.randomBytes(16).toString('hex')
}
