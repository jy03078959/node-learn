'use strict'
const db = require('../model')
const PAGE_SIZE = 20
let contactAPI = module.exports = {}

contactAPI.list = function *() {
  let token = this.token
  let query = this.query
  let type = query.type || 'private'
  let conds = {}
  let q = query.q
  let page = query.page || 1
  let contacts = []
  type = type.toLowerCase().trim()

  if (type === 'private') {
    conds.type = db.contact.TYPE_TYPE.PRIVATE
    conds.user_id = token.i
  } else {
    conds.type = db.contact.TYPE_TYPE.PUBLIC
  }

  if (q) {
    conds['$or'] = {
      'mobile$like': `%${q}%`,
      'realname$like': `%${q}%`,
      'email$like': `%${q}%`,
      'phone$like': `%${q}%`,
      'bank$like': `%${q}%`,
      'area$like': `%${q}%`
    }
  }

  if (query.realname) conds.realname = query.realname
  if (query.mobile) conds.mobile = query.mobile
  if (query.phone) conds.phone = query.phone
  if (query.email) conds.email = query.email
  if (query.bank) conds.bank = query.bank
  if (query.area) conds.area = query.area

  contacts = yield db.contact.find(conds, {
    page: page,
    pagesize: PAGE_SIZE
  })
  this.body = contacts.map((contact) => showContactUser(contact))
}

function showContactUser (contact) {
  let extra = contact.extra || {}
  let bankInfo = extra.bankInfo || {}

  return {
    id: contact.id,
    verified: contact.verified,
    user_id: contact.app_user_id || '',
    avatar: contact.avatar || '',
    realname: contact.realname || '',
    phone: contact.phone ? contact.phone.replace(/\d{3}$/, '***') : '',
    email: contact.email || '',
    mobile: contact.mobile || '',
    funpjAccount: contact.app_user_id && contact.mobile ? contact.phone.replace(/\d{3}$/, '***') + '@funpj.com' : '',
    bank: contact.bank || '',
    area: contact.area || '',
    note: contact.note || '',

    // extra info
    bankName: bankInfo.bankName || '',
    bankAddress: bankInfo.bankAddress || '',
    bankAccount: bankInfo.bankAccount || '',
    bankAccountName: bankInfo.bankAccountName || '',
    bankNumber: bankInfo.bankNumber || ''
  }
}
