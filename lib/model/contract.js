'use strict'
module.exports = function (Schema) {
  let contract = new Schema('contract', {
    id: Schema.types.number,
    user_id: Schema.types.number,
    list_id: Schema.types.number,
    status: Schema.types.number,
    create_time: Schema.types.date,
    update_time: Schema.types.date,
    extra: Schema.types.extra({
      buyer: {
        name: Schema.types.string,
        account_name: Schema.types.string,
        account_number: Schema.types.string,
        bank_name: Schema.types.string,
        bank_number: Schema.types.string
      },
      saler: {
        name: Schema.types.string,
        account_name: Schema.types.string,
        account_number: Schema.types.string,
        bank_name: Schema.types.string,
        bank_number: Schema.types.string
      }
    })
  })

  contract.STATUS_TYPE = {
    NORMAL: 0,
    FREEZE: 1
  }
  return contract
}
