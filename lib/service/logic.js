'use strict'

const _ = require('lodash')
const thunk = require('thunks')()
const moment = require('moment')
const Queue = require('thunk-queue')
const db = require('../model')
const ONE_DAY = 86400 * 1000
const ONE_YEAR = 360
const BILL_TYPES = {
  0: '国股',
  1: '城商',
  2: '农商',
  3: '农商',
  4: '农合',
  5: '财务公司',
  6: '其他'
}

let L = module.exports = {}

L.makeWechatContent = function (list) {
  let contentArr = []
  let totalWan = 0
  for (let typeId in list.extra.bankInfo) {
    let amount = list.extra.bankInfo[typeId].sum
    let amountWan = Math.round(amount / 10000)
    contentArr.push(`${BILL_TYPES[typeId]} ${amountWan}万`)
    totalWan += amountWan
  }
  contentArr.unshift(`总计 ${totalWan}万`)
  let content = contentArr.join(', ')
  return content
}

L.calculateBillForUser = function *(bill_id, user_id) {
  let listbills = yield db.listbill.findWithList({
    bill_id: bill_id,
    status: db.listbill.STATUS_TYPE.NORMAL
  }, {
    sort: 'transaction_date ASC'
  })
  let lists = listbills.map((listbill) => listbill.list)
  let own = false
  for (let i in lists) {
    let list = lists[i]
    // TODO: 判断条件 还有缺陷，需要修改
    if (list.transaction_type === db.list.TRANSACTION_TYPE.BUY ||
      list.transaction_type === db.list.TRANSACTION_TYPE.BUY_RETURN) {
      own = true
    } else if (list.transaction_type === db.list.TRANSACTION_TYPE.SELL ||
      list.transaction_type === db.list.TRANSACTION_TYPE.SELL_RETURN) {
      own = false
    }
  }

  let userbill = yield db.userbill.load({
    user_id: user_id,
    bill_id: bill_id,
    status: db.userbill.STATUS_TYPE.NORMAL})

  if (own && userbill) {
    yield db.userbill.update(userbill.id, {update_time: new Date()})
  } else if (own && !userbill) {
    userbill = {
      user_id: user_id,
      bill_id: bill_id,
      status: db.userbill.STATUS_TYPE.NORMAL,
      create_time: new Date(),
      update_time: new Date()
    }
    yield db.userbill.insert(userbill)
  } else if (!own && userbill) {
    yield db.userbill.update(userbill.id, {status: db.userbill.STATUS_TYPE.DELETED, update_time: new Date()})
  }
}

L.calculateList = function *(list_id) {
  console.log('caculate list', list_id)
  let list = yield db.list.load({id: list_id})
  if (!list) throw new Error('no list')
  let defaultList = {
    total_interest: 0,
    total_paid: 0,
    total_sum: 0,
    bill_type: db.list.BILL_TYPE.UNKNOWN,
    three_days_free: 0,
    total_bill_num: 0
  }
  let defaultExtra = {
    bankInfo: {}
  }
  _.assign(list, defaultList)
  _.assign(list.extra, defaultExtra)

  let isFuture = false
  if (list.transaction_type === db.list.TRANSACTION_TYPE.BUY_RETURN ||
      list.transaction_type === db.list.TRANSACTION_TYPE.SELL_RETURN) {
    isFuture = true
  }

  let listbills = yield db.listbill.findWithBill({list_id: list_id})
  let queue = Queue()
  for (let i in listbills) {
    let bill = listbills[i].bill
    let listbill = listbills[i].listbill

    list.total_bill_num++
    list.total_sum += bill.sum

    list.bill_type =
      list.bill_type !== db.list.BILL_TYPE.UNKNOWN &&
      list.bill_type !== bill.bill_type
      ? db.list.BILL_TYPE.MIXED
      : bill.bill_type
    let bankInfo = list.extra.bankInfo[bill.accept_bank_type] = list.extra.bankInfo[bill.accept_bank_type] || {
      num: 0,
      sum: 0
    }
    bankInfo.num ++
    bankInfo.sum += bill.sum

    let interestDays = 0
    if (!bill.is_calculated_holiday) {
      bill.holiday = yield calculateHolidays(bill.end_date)
      yield db.bill.update(bill.id, {holiday: bill.holiday, is_calculated_holiday: 1})
    }

    if (isFuture) {
      interestDays = moment(list.future_date).diff(moment(list.transaction_date), 'days', true)
    } else {
      interestDays = moment(bill.end_date).diff(moment(list.transaction_date), 'days', true)
      if (list.is_delay) interestDays += bill.holiday
      if (!list.is_local) interestDays += 3
    }

    interestDays = Math.max(0, interestDays)
    interestDays = Math.ceil(interestDays)
    let interest = bill.sum * list.interest_rate / 100 * interestDays / ONE_YEAR
    interest = Math.round(interest * 100) / 100

    let listbillInfo = {
      interest_rate: list.interest_rate,
      interest_calculated_days: interestDays,
      interest: interest,
      paid: bill.sum - interest
    }
    queue.push(db.listbill.update(listbill.id, listbillInfo))
    list.total_interest += interest
    list.total_paid += bill.sum - interest
    queue.push(L.calculateBillForUser(bill.id, list.User_id))
  }
  queue.push(db.list.update(list.id, list))
  if (list.status === db.list.STATUS_TYPE.CONFIRMED || list.status === db.list.STATUS_TYPE.DELETED) {
    yield L.calculateUserStatics(list.user_id)
  }
  yield queue.end
  return list
}

L.calculateUserStatics = function *(user_id) {
  // let user = yield db.user.load({id: user_id})
  // user.statics
}

L.getAppromixBillList = function (list, target, step) {
  list = _.sortBy(list, (bill) => bill.sum)
  // console.log(list)
  let n = list.length
  let c = 0
  let result

  c = target
  let v = []

  let s = list.map((bill) => bill.sum)
  s.unshift(0)
  let vv = list.map((bill) => bill.sum)
  let vi = list.map((bill) => bill.id)
  let hashs = {0: []}
  vv.unshift(0)

  // let step
  step = step || 1

  for (let i = 0; i <= n; i++) {
    v.push(Array(c + 1))
    v[i][0] = 0
  }
  for (let j = 0; j <= c; j++) v[0][j] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= c; j += step) {
      j = Math.round(j)
      v[i][j] = v[i - 1][j]
      if (s[i] <= j && v[i - 1][j - s[i]] + vv[i] > v[i][j]) {
        v[i][j] = v[i - 1][j - s[i]] + vv[i]
        hashs[v[i][j]] = hashs[v[i - 1][j - s[i]]].concat(vi[i])
        result = hashs[v[i][j]]
      }
    }
  }
  return result
}

function * calculateHolidays (day) {
  let tradeDay = moment(day)
  let holiday = 0
  // let tradeDay = moment(list.transaction_date)
  // if (list.is_delay) {
  let isHoliday
  do {
    isHoliday = yield db.holiday.load({
      'holiday_time$>=': moment(tradeDay).startOf('day').toDate(),
      'holiday_time$<': moment(tradeDay).endOf('day').toDate(),
      status: db.holiday.STATUS_TYPE.ON
    })
    if (isHoliday) holiday++
    tradeDay.add(1, 'day')
  } while (isHoliday)
  return holiday
}
