'use strict'
const moment = require('moment')
const thunk = require('thunks')()

const db = require('../model')
const logic = require('../service/logic')

module.exports = importList
function * importList (userId, data, info) {
  let interestRate = Math.round(Number(data.list.interest_rate) * 100 * 10000) / 10000
  let list = {
    user_id: userId,
    status: db.list.STATUS_TYPE.DRAFT,
    create_time: info.date && new Date(info.date).getTime() > 0 ? new Date(info.date) : new Date(),
    transaction_date: new Date(data.list.transaction_date),
    interest_rate: interestRate,
    is_delay: 1,
    is_local: 1,
    extra: {
      io: info.iotype,
      emailInfo: {
        subject: info.subject,
        target: info.target,
        body: info.body,
        date: info.date,
        filename: info.filename
      }
    }
  }

  yield db.list.insert(list)

  let holidays = yield data.bills.map(function (_bill) {
    return calculateHolidays(new Date(_bill.end_date))
  })

  let bills = yield data.bills.map(function (_bill, i) {
    // let data = _bill.data
    let bill = {
      bill_number: String(_bill.bill_number || ''),
      sum: Number(_bill.sum),
      bill_type: Number(_bill.bill_type),
      accept_bank_type: Number(_bill.accept_bank_type),
      begin_date: new Date(_bill.begin_date),
      end_date: new Date(_bill.end_date),
      launch_company: String(_bill.launch_company || ''),
      accept_company: String(_bill.accept_company || ''),
      accept_bank_number: String(_bill.accept_bank_number || ''),
      accept_bank: String(_bill.accept_bank || ''),
      holiday: holidays[i],
      extra: {}
    }
    return db.bill.insert.bind(db.bill)(bill)
  })

  let isLocal = true
  yield thunk.all(bills.map(function (bill, i) {
    let interestCalculatedDays = 0
    if (list.future_date) {
      interestCalculatedDays = moment(list.future_date).diff(moment(list.transaction_date), 'days')
    } else {
      interestCalculatedDays = moment(bill.end_date).diff(moment(list.transaction_date), 'days')
    }

    if (data.bills[i].interest_calculated_days) {
      let offsiteDay = Math.abs(Math.round(data.bills[i].interest_calculated_days - interestCalculatedDays))
      if (offsiteDay >= 3) isLocal = false
    }

    let listbill = {
      user_id: list.user_id,
      list_id: list.id,
      bill_id: bill.id,
      transaction_date: list.transaction_date,
      interest_calculated_days: Math.round((bill.end_date - list.transaction_date) / 86400),
      interest_rate: list.interest_rate,
      interest: 0,
      paid: 0,
      buyback_end_date: new Date(0),
      create_time: new Date(),
      extra: {origin: data.bills[i]}
    }
    return db.listbill.insert.bind(db.listbill)(listbill)
  }))

  if (!isLocal) {
    yield db.lsit.update(list.id, {is_local: 0})
  }

  list = yield logic.calculateList(list.id)
  return list
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
