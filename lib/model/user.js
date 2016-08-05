'use strict'

module.exports = function (Schema) {
  let user = new Schema('user', {
    id: Schema.types.number,
    status: Schema.types.number,
    admin: Schema.types.number,
    username: Schema.types.string,
    password: Schema.types.string,
    realname: Schema.types.string,
    avatar: Schema.types.string,
    phone: Schema.types.string,
    mobile: Schema.types.string,
    email: Schema.types.string,
    funpj_account: Schema.types.string,
    bank: Schema.types.string,
    area: Schema.types.string,
    note: Schema.types.string,
    create_time: Schema.types.date,
    update_time: Schema.types.date,
    register_ip: Schema.types.string,
    wechat_union_id: Schema.types.string,
    wechat_mp_open_id: Schema.types.string,
    statics: Schema.types.json,
    extra: Schema.types.json
  })

  user.STATUS_TYPE = {
    NORMAL: 0,
    FREEZE: 1
  }

  return user
}
