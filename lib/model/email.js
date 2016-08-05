'use strict'
module.exports = function (Schema) {
  let email = new Schema('email', {
    id: Schema.types.number,
    user_id: Schema.types.number,
    status: Schema.types.number,
    delete_status: Schema.types.number,
    email: Schema.types.string,
    password: Schema.types.string,
    create_time: Schema.types.date,
    update_time: Schema.types.date,
    fetch_time: Schema.types.date,
    fetch_uid: Schema.types.string,
    extra: Schema.types.extra({
      imapHost: Schema.types.string,
      imapPort: Schema.types.number,
      inbox: Schema.types.string,
      last_fail_time: Schema.types.date,
      last_fail_reason: Schema.types.string,
      tls: Schema.types.number,
      mailbox: Schema.types.object
    })
  })

  email.STATUS_TYPE = {
    NORMAL: 1,
    INVALID: 2,
    FETCHING: 3
  }
  email.DELETE_STATUS_TYPE = {
    NO: 0,
    YES: 1
  }

  return email
}
