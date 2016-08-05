'use strict'

module.exports = function (Schema, model) {
  let userbill = new Schema('user_bill', {
    id: Schema.types.number,
    user_id: Schema.types.number,
    status: Schema.types.number,
    bill_id: Schema.types.number,
    create_time: Schema.types.date,
    update_time: Schema.types.date,
    extra: Schema.types.json
  })

  userbill.STATUS_TYPE = {
    NORMAL: 0,
    DELETED: 1
  }

  userbill.findWithBill = function *(cond, options) {
    let db = userbill.db
    let prefix = db.prefix
    options = options || {}
    let joins = options.joins || (options.joins = [])
    joins.push({
      type: 'LEFT',
      table: 'bill',
      cond: [
        `${prefix}_bill.id = ${prefix}_user_bill.id`
      ]
    })
    options.nestTables = true
    let result = yield db.find(cond, options)
    return result.map(function (row) {
      return {
        userbill: userbill.decodeSchema(row[`${prefix}_user_bill`]),
        bill: model.model('bill').decodeSchema(row[`${prefix}_bill`])
      }
    })
  }

  return userbill
}
