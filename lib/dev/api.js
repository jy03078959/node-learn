'use strict'

const config = require('config')
const moment = require('moment')
const debug = require('debug')('dev')
const db = require('../model')
const logic = require('../service/logic')

module.exports.ping = function *() {
  this.body = this.token
}

module.exports.login = function *() {
  let id = parseInt(this.query.id, 10)
  if (!id) this.throw(400, 'no user id')

  let user = {id: id, activate: 1}
  let access_token = this.signToken({
    t: Date.now(),
    i: user.id,
    a: user.activate
  })

  this.cookies.set('PJ_SESSION', access_token)
  // this.token
  this.body = {
    access_token: 'Bearer ' + access_token
  }
}

module.exports.postList = function *() {
  let id = parseInt(this.query.id, 10)
  if (!id) this.throw(400, 'no user id')
  let user = yield db.user.load({id: id})
  if (!user) this.throw(400, 'no user')
  let list = {
    user_id: id,
    interest_rate: Math.random() * 10,
    total_interest: 0,
    total_paid: 0,
    total_sum: 0,
    bill_type: 0,
    transaction_type: 0,
    target_name: 'Sample Target Name',
    target_bank: 'Sample Target Bank',
    holiday: 0,
    three_days_free: 0,
    total_bill_num: 0,
    transaction_date: (moment().add(Math.random() * 100, 'd')).toDate(),
    future_date: new Date(0),
    status: 0,
    create_time: new Date(),
    inbox_time: new Date(0),
    title: 'sample title',
    note: 'sample note',
    extra: {}
  }

  yield db.list.insert(list)
  this.body = list
}

module.exports.postBill = function *() {
  let id = this.query.id
  if (!id) this.throw(400, 'no list id')
  let list = yield db.list.load({id: id})
  if (!list) this.throw(400, 'no list')
  let bill = {
    bill_number: '0000000000000',
    sum: Math.random() * 500000 + 100000,
    bill_type: 0,
    accept_bank_type: 0,
    begin_date: new Date(),
    end_date: new Date(),
    launch_company: 'Sample Launch Company',
    accept_company: 'Sample Accept Company',
    accept_bank_number: '111111111111',
    accept_bank: 'XXX Bank of China',
    extra: {}
  }
  yield db.bill.insert(bill)

  let listbill = {
    user_id: list.user_id,
    list_id: list.id,
    bill_id: bill.id,
    trancation_date: list.transaction_date,
    interest_calculated_days: Math.round((list.transaction_date - bill.end_date) / 86400),
    interest_rate: list.interest_rate,
    interest: 0,
    paid: 0,
    buyback_end_date: new Date(0),
    create_time: new Date(),
    extra: {}
  }
  yield db.listbill.insert(listbill)
  yield logic.calculateList(list.id)
}

module.exports.wechat = function *() {
  let app_id = config.wechat.web.app_id
  let redirect_uri = `http://${this.hostname}/wx`
  let scope = 'snsapi_login'
  let state = '123456'
  let url = `https://open.weixin.qq.com/connect/qrconnect?appid=${app_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`
  this.redirect(url)
}

module.exports.upload = function *() {
  this.query.sign = this.signToken({
    t: Date.now(),
    i: this.query.id || 1,
    a: 1
  })

  return yield require('../api/bill').uploadList.call(this)
}
