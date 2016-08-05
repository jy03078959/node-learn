'use strict'

const _ = require('lodash')
const path = require('path')
const fs = require('fs')
const config = require('config')
const Form = require('formidable')
const Stream = require('thunk-stream')
const Queue = require('thunk-queue')
const moment = require('moment')
const debug = require('debug')('bill-api')
const db = require('../model')
const thunk = require('thunks')()
const LIST_PAGE_SIZE = 25
const BILL_PAGE_SIZE = 25

const parseExcel = require('../service/parseExcel2')
const importList = require('../service/importList')
const Wechat = require('../service/wechat')
const logic = require('../service/logic')
const Err = require('../error')

let billAPI = module.exports = {}

billAPI.getUserLists = function *() {
  let token = this.token
  let page = this.query.page || 1
  let conds = {
    user_id: token.i
  }

  if (this.query.status !== undefined) {
    conds.status = this.query.status
  }

  if (this.query.future) {
    let future = new Date(this.query.future)
    if (!isFinite(future.getTime())) throw new Err('invalid params', 'future')
    conds['future_date$>='] = moment(future).startOf('day').toDate()
    conds['future_date$<'] = moment(future).endOf('day').toDate()
  }

  let lists = yield db.list.find(conds, {
    sort: 'create_time DESC',
    page: page,
    pagesize: LIST_PAGE_SIZE
  })
  this.body = lists
}

billAPI.getUserBills = function *() {
  let token = this.token
  let page = this.query.page || 1
  let userbills = yield db.userbill.findWithBill({
    user_id: token.i,
    status: db.userbill.STATUS_TYPE.NORMAL
  }, {
    page: page,
    pagesize: LIST_PAGE_SIZE
  })
  this.body = userbills
}

billAPI.getFutureList = function *() {
  let token = this.token
  let limit = this.query.limit || 6
  let lists = yield db.list.aggregate({
    timestamp: '(floor((future_date + 8 * 3600) / 86400) * 86400 - 8 * 3600) * 1000',
    count: 'count(1)',
    buy: 'sum(if(transaction_type = 1 or transaction_type = 3, total_paid, 0))',
    sell: 'sum(if(transaction_type = 2 or transaction_type = 4, total_paid, 0))',
    unknown: 'sum(if(transaction_type = 0, total_paid, 0))'
  }, {
    user_id: token.i,
    'future_date$>': moment().startOf('day').toDate()
  }, ['floor((future_date + 8 * 3600) / 86400) - 8 * 3600'], {
    pagesize: limit
  })
  lists.map(function (list) {
    list.future_date = moment(new Date(list.timestamp)).startOf('day').toDate()
    delete list.timestamp
  })
  this.body = lists
}

billAPI.getList = function *() {
  let token = this.token
  let list_id = this.params.list_id
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')
  this.body = list
}

billAPI.getListBills = function *() {
  let token = this.token
  let list_id = this.params.list_id
  let page = this.query.page
  if (!list_id) throw new Err('invalid params', 'list_id')
  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')
  let result = yield db.listbill.findWithBill({
    user_id: token.i,
    list_id: list_id
  }, {
    sort: 'end_date ASC',
    page: page,
    pagesize: BILL_PAGE_SIZE
  })
  result = result.map(function (row) {
    return _.assign({}, row.listbill, row.bill)
  })
  this.body = result
}

billAPI.getListBill = function *() {
  let token = this.token

  let list_id = this.params.list_id
  let bill_id = this.params.bill_id
  if (!list_id || !bill_id) throw new Err('invalid params', ['list_id', 'bill_id'])

  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')

  let list_bill = yield db.listbill.load({list_id: list_id, bill_id: bill_id})
  if (!list_bill) throw new Err('not found', 'bill')

  let bill = yield db.bill.load({id: bill_id})
  if (!bill) throw new Err('not found', 'bill')

  let result = _.assign({}, list_bill, bill)
  this.body = result
}

billAPI.copyList = function *() {
  let token = this.token
  let list_id = this.params.list_id
  if (!list_id) throw new Err('invalid params', 'list_id')

  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')
  if (list.status === db.list.STATUS_TYPE.DELETED) throw new Err('not found', 'list')

  let newList = _.assign({}, list)
  newList.status = db.list.STATUS_TYPE.HIDDEN
  newList.create_time = new Date()
  newList.update_time = new Date()
  delete newList.id
  newList = yield db.list.insert(newList)

  let listbills = yield db.listbill.findWithBill({list_id: list.id})
  yield thunk.all(listbills.map(function (listbill) {
    let newListBill = _.assign({}, listbill.listbill)
    delete newListBill.id
    newListBill.list_id = newList.id
    return db.listbill.insert.bind(db.listbill)(newListBill)
  }))
  this.body = newList
}

billAPI.updateListBill = function *() {
  let token = this.token
  let list_id = this.params.list_id
  let body = yield this.parseBody()
  if (this.state.status !== undefined) body.status = this.state.status
  let bills = body.bills || []
  if (!list_id) throw new Err('invalid params', 'list_id')
  // if (body.status === db.list.STATUS_TYPE.DELETED) throw new Err('invalid params', ['status'])

  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')
  if (list.status === db.list.STATUS_TYPE.DELETED) throw new Err('invalid list')

  let userbills = yield db.userbill.findWithBill({user_id: token.i})
  let userbillIds = userbills.map((userbill) => userbill.bill.id)
  let extraBillIds = _.difference(bills, userbillIds)
  if (extraBillIds.length) {
    // TODO: dont throw Err when list bills not fit user bills
    // throw new Err('user bill not exist')
  }

  let listbills = yield db.listbill.findWithBill({list_id: list.id})

  yield thunk.all(listbills.map((listbill) => db.listbill.update.bind(db.listbill)(listbill.listbill.id, {
    status: db.listbill.STATUS_TYPE.DELETED
  })))

  yield thunk.all(bills.map((billId) => db.listbill.insert.bind(db.listbill)({
    user_id: list.user_id,
    list_id: list.id,
    bill_id: billId,
    create_time: new Date(),
    extra: {}
  })))

  yield logic.calculateList(list.id)
  this.body = list
}

billAPI.updateList = function *() {
  let token = this.token
  let list_id = this.params.list_id
  let body = yield this.parseBody()
  if (this.state.status !== undefined) body.status = this.state.status
  if (!list_id) throw new Err('invalid params', 'list_id')
  // if (body.status === db.list.STATUS_TYPE.DELETED) throw new Err('invalid params', ['status'])

  let list = yield db.list.load({user_id: token.i, id: list_id})
  if (!list) throw new Err('not found', 'list')
  if (list.status === db.list.STATUS_TYPE.DELETED) throw new Err('invalid list')

  let newlist = {}

  if (body.interest_rate !== undefined) newlist.interest_rate = body.interest_rate
  if (body.transaction_type !== undefined) newlist.transaction_type = body.transaction_type
  if (body.target_name !== undefined) newlist.target_name = body.target_name
  if (body.target_bank !== undefined) newlist.target_bank = body.target_bank
  if (body.transaction_date !== undefined) newlist.transaction_date = new Date(body.transaction_date)
  if (body.future_date !== undefined) newlist.future_date = new Date(body.future_date)
  if (body.status !== undefined) newlist.status = body.status
  if (body.title !== undefined) newlist.title = body.title
  if (body.note !== undefined) newlist.note = body.note
  if (body.is_delay !== undefined) newlist.is_delay = body.is_delay
  if (body.is_local !== undefined) newlist.is_local = body.is_local

  let needRecalculate = false
  if (
    (body.status && body.status === db.list.STATUS_TYPE.CONFIRMED) ||
    (body.interest_rate && body.interest_rate !== list.interest_rate) ||
    (body.transaction_date && new Date(body.transaction_date).getTime() !== list.transaction_date.getTime()) ||
    (body.is_delay && body.is_delay !== list.is_delay) ||
    (body.is_local && body.is_local !== list.is_local)
    ) {
    needRecalculate = true
  }
  yield db.list.update(list.id, newlist)
  list = _.assign(list, newlist)
  if (needRecalculate) yield logic.calculateList(list.id)
  this.body = list
}

billAPI.deleteList = function *() {
  this.state.status = db.list.STATUS_TYPE.DELETED
  return yield billAPI.updateList.call(this)
}

billAPI.createList = function *() {
  let token = this.token
  let body = yield this.parseBody()
  let bills = body.bills || []
  if (!Array.isArray(bills)) throw new Err('invalid params', 'bills')

  let list = {
    user_id: token.i,
    interest_rate: body.interest_rate || 0,
    total_interest: 0,
    total_paid: 0,
    total_sum: 0,
    bill_type: 0,
    transaction_type: body.transaction_type || 0,
    target_name: body.target_name || '',
    target_bank: body.target_bank || '',
    holiday: 0,
    three_days_free: 0,
    total_bill_num: 0,
    transaction_date: new Date(body.transaction_date),
    future_date: body.future_date ? new Date(body.future_date) : new Date(0),
    status: body.status || 0,
    create_time: new Date(),
    inbox_time: new Date(),
    title: body.title || '',
    note: body.note || '',
    extra: {}
  }

  let userbills = yield db.userbill.findWithBill({user_id: token.i})
  let userbillIds = userbills.map((userbill) => userbill.bill.id)
  let extraBillIds = _.difference(bills, userbillIds)
  if (extraBillIds.length) throw new Err('user bill not exist')

  yield db.list.insert(list)
  yield thunk.all(bills.map((billId) => db.listbill.insert.bind(db.listbill)({
    user_id: list.user_id,
    list_id: list.id,
    bill_id: billId,
    create_time: new Date(),
    extra: {}
  })))

  yield logic.calculateList(list.id)
  this.body = list
}

billAPI.getBillsBySum = function *() {
  let token = this.token

  let banktype = this.query.banktype
  let sum = this.query.sum

  let userbills = yield db.userbill.findWithBill({user_id: token.i, accept_bank_type: banktype})
  let bills = userbills.map(function (row) { return row.bill })
  this.body = result
}

billAPI.uploadList = function *() {
  let token = this.token
  let user = yield db.user.load({id: token.i})
  let form = new Form()
  form.uploadDir = '/dev/null'
  let formData = {}
  let files = []
  let queue = Queue()
  form.onPart = function (part) {
    // console.log('part', part)
    if (part.name === 'file' && part.filename) {
      // let fileData = formData
      // TODO: check extension
      // TODO: check file size
      // TODO: random create filename seperator by year-month
      let filepath = path.join(config.attachmentDirectory, 'upload', part.filename)
      let ws = fs.createWriteStream(filepath)
      files.push({
        filename: part.filename,
        filepath: filepath
      })
      ws.on('error', function (error) {
        console.log('write file', error)
        throw error
      })
      formData = {}
      part.pipe(ws)
      queue.push(Stream(ws))
    } else {
      let buffer = new Buffer(0)
      part.on('data', (data) => buffer = Buffer.concat([buffer, data]))
      part.on('end', () => formData[part.name] = buffer.toString())
    }
  }
  form.parse(this.req)
  yield Stream(form)
  yield queue.end()

  let successImport = 0
  if (!files.length) throw new Err('invalid params', 'files')
  for (let i in files) {
    try {
      let filepath = files[i].filepath
      let fileData = yield parseExcel(filepath)
      for (let j in fileData) {
        if (fileData[j] instanceof Error) continue
        let list = yield importList(token.i, fileData[j], {
          filename: `${files[i].filename}[${j}]`,
          iotype: 'upload'
        })

        let content = logic.makeWechatContent(list)
        yield Wechat.sendMessage(
          user,
          `http://open.weixin.qq.com/connect/oauth2/authorize?appid=wx07c7271a9f713a3c&redirect_uri=https%3A%2F%2F5443.funpj.com%2Fwebclient%2Findex.html%23%2Ftrade%2Fwaitbill&response_type=code&scope=snsapi_userinfo&state=123`,
          `您收到一份${user.realname}<${user.mobile}@funpj.com>通过funpj.com网站上传的交易清单，请处理`,
          content,
          '点击立即处理，确认交易后，可体验极速合同生成服务',
          ''
        )

        successImport++
      }
    } catch (e) {
      console.error(e, e.stack)
      continue
    }
  }
  this.body = {
    success: successImport
  }
}
