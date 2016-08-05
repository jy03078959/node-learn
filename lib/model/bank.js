'use strict'
module.exports = function (Schema) {
  let bank = new Schema('bank', {
    id: Schema.types.number,
    status: Schema.types.number,
    rate: Schema.types.number,
    name: Schema.types.string,
    bank_name: Schema.types.string,
    bank_number: Schema.types.string,
    account_name: Schema.types.string,
    account_number: Schema.types.string,
    address: Schema.types.string,
    create_time: Schema.types.date,
    update_time: Schema.types.date
  })

  bank.STATUS_TYPE = {
    NORMAL: 0,
    FREEZE: 1
  }

  return bank
}
