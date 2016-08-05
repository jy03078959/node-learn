'use strict'
module.exports = function (Schema) {
  let list = new Schema('list', {
    id: Schema.types.number,
    user_id: Schema.types.number,
    status: Schema.types.number,
    total_interest: Schema.types.number,
    total_paid: Schema.types.number,
    total_sum: Schema.types.number,
    interest_rate: Schema.types.number,
    bill_type: Schema.types.number,
    transaction_type: Schema.types.number,
    target_name: Schema.types.string,
    target_bank: Schema.types.string,
    is_local: Schema.types.number,
    is_delay: Schema.types.number,
    holiday: Schema.types.number,
    three_days_free: Schema.types.number,
    total_bill_num: Schema.types.number,
    transaction_date: Schema.types.date,
    future_date: Schema.types.date,
    create_time: Schema.types.date,
    title: Schema.types.string,
    note: Schema.types.string,
    origin_list_id: Schema.types.number,
    extra: Schema.types.extra({
      io: Schema.types.string,
      emailInfo: {
        subject: Schema.types.string,
        target: Schema.types.string,
        body: Schema.types.string,
        date: Schema.types.string,
        filename: Schema.types.string
      },
      bankInfo: Schema.types.object
    })
  })

  list.LOCATION_TYPE = {
    OFFSITE: 0,
    LOCAL: 1
  }

  list.DELAY_TYPE = {
    NOW: 0,
    DELAY: 1
  }

  list.BILL_TYPE = {
    ZHI_YIN: 0,
    ZHI_SHANG: 1,
    DIAN_YIN: 2,
    DIAN_SHANG: 3,
    MIX: 4,
    UNKNOWN: 5
  }
  list.STATUS_TYPE = {
    DRAFT: 0,
    CONFIRMED: 1,
    DELETED: 2,
    HIDDEN: 3
  }
  list.TRANSACTION_TYPE = {
    UNKNOWN: 0,
    BUY: 1,
    SELL: 2,
    BUY_RETURN: 3,
    SELL_RETURN: 4
  }

  return list
}
