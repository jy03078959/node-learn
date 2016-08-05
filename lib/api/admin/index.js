'use strict'
const _ = require('lodash')
const moment = require('moment')
const db = require('../../model')
const Err = require('../../error')

let adminAPI = module.exports = {}

adminAPI.root = function *() {
  yield verifyToken.call(this)
  this.body = {}
}

adminAPI.getHolidayByMonth = function *() {
  yield verifyToken.call(this)
  let day = this.query.day
  let date = moment()
  if (day && new Date(day).getTime()) date = moment(new Date(day))
  let holidays = yield db.holiday.find({
    'holiday_time$>=': date.clone().startOf('month').toDate(),
    'holiday_time$<': date.clone().endOf('month').toDate()
  })
  holidays.map(function (holiday) {
    holiday.date = moment(new Date(holiday.holiday_time)).format('YYYY-MM-DD')
  })
  this.body = holidays
}

adminAPI.postHoliday = function *() {
  yield verifyToken.call(this)
  let body = yield this.parseBody()
  let day = this.params.day
  let description = String(body.description)
  let isHoliday = body.isHoliday !== false
  if (!day || !(new Date(day).getTime())) throw new Err('invalid params', 'day')
  let holiday_time = moment(new Date(day)).startOf('day').toDate()
  // console.log(day, isHoliday)
  let holiday = yield db.holiday.load({holiday_time: holiday_time})
  if (holiday) {
    yield db.holiday.update(holiday.id, {
      description: description,
      status: isHoliday ? db.holiday.STATUS_TYPE.ON : db.holiday.STATUS_TYPE.OFF
    })
  } else {
    yield db.holiday.insert({
      holiday_time: holiday_time,
      description: description,
      status: db.holiday.STATUS_TYPE.ON
    })
  }
  this.body = {}
}

adminAPI.verifyContact = function *() {
  yield verifyToken.call(this)
}

adminAPI.getPublicContacts = function *() {
  yield verifyToken.call(this)
  let query = this.query
  let page = query.page

  let conds = _.assign({}, query)
  delete conds.page

  this.body = yield db.contact.find(conds, {page: page, pagesize: 100})
}

adminAPI.createContact = function *() {
  yield verifyToken.call(this)
  let body = yield this.parseBody()
  let updateInfo = _.assign({}, body)
  let contact = yield db.contact.insert(updateInfo)
  this.body = contact
}

adminAPI.updateContact = function *() {
  yield verifyToken.call(this)
  let contact_id = this.params.id || this.query.id
  let body = yield this.parseBody()
  let updateInfo = _.assign({}, body)
  yield db.contact.update(contact_id, updateInfo)
}

function * verifyToken (token, admin) {
  admin = admin || 1
  // let user = this.state.user = yield db.user.load({id: token.i, admin: admin})
  // if (!user) throw new Err('no auth')
  // return user
}
