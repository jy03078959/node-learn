'use strict'
module.exports = function (Schema) {
  let bill = new Schema('bill', {
    id: Schema.types.number,
    status: Schema.types.number,
    bill_number: Schema.types.string,
    sum: Schema.types.number,
    bill_type: Schema.types.number,
    accept_bank_type: Schema.types.number,
    begin_date: Schema.types.date,
    end_date: Schema.types.date,
    holiday: Schema.types.number,
    is_calculated_holiday: Schema.types.number,
    launch_company: Schema.types.string,
    accept_company: Schema.types.string,
    accept_bank_number: Schema.types.number,
    accept_bank: Schema.types.string,
    extra: Schema.types.json
  })

  bill.BILL_TYPE = {
    ZHI_YIN: 0,
    ZHI_SHANG: 1,
    DIAN_YIN: 2,
    DIAN_SHANG: 3,
    MIX: 4
  }
  bill.STATUS_TYPE = {
    DRAFT: 0,
    CONFIRMED: 1,
    DELETED: 2
  }
  bill.BANK_TYPE = {
    GUO_GU: 0,
    CHENG_SHANG: 1,
    NONG_SHANG: 2,
    NONG_SHANG2: 3,
    NONG_HE: 4,
    CAI_WU_GONG_SI: 5,
    OTHER: 6
  }

  return bill
}
