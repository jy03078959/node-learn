'use strict'
module.exports = function (Schema) {
  let contact = new Schema('contact', {
    id: Schema.types.number,
    user_id: Schema.types.number,
    status: Schema.types.number,
    type: Schema.types.number,
    realname: Schema.types.string,
    avatar: Schema.types.string,
    phone: Schema.types.string,
    mobile: Schema.types.string,
    email: Schema.types.string,
    bank: Schema.types.string,
    area: Schema.types.string,
    app_user_id: Schema.types.number,
    rate: Schema.types.number,
    create_time: Schema.types.date,
    update_time: Schema.types.date,
    note: Schema.types.string,
    extra: Schema.types.json
  })
  contact.STATUS_TYPE = {
    NORMAL: 0,
    FREEZE: 1
  }
  contact.TYPE_TYPE = {
    PRIVATE: 0,
    PUBLIC: 1
  }
  return contact
}
