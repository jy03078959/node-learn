'use strict'

module.exports = function (Schema, collection) {
  let listbill = new Schema('list_bill', {
    id: Schema.types.number,
    status: Schema.types.number,
    user_id: Schema.types.number,
    list_id: Schema.types.number,
    bill_id: Schema.types.number,
    trancation_date: Schema.types.date,
    interest_calculated_days: Schema.types.number,
    interest_rate: Schema.types.number,
    interest: Schema.types.number,
    paid: Schema.types.number,
    // buyback_end_date: Schema.types.date,
    create_time: Schema.types.date,
    extra: Schema.types.json
  })

  listbill.STATUS_TYPE = {
    NORMAL: 0,
    DELETED: 1
  }

  listbill.findWithBill = function *(cond, options) {
    let db = listbill.db
    let prefix = db.prefix
    options = options || {}
    let joins = options.joins || (options.joins = [])
    joins.push({
      type: 'LEFT',
      table: 'bill',
      cond: [
        `${prefix}_bill.id = ${prefix}_list_bill.bill_id`
      ]
    })
    options.nestTables = true
    let result = yield db.find(this.table, listbill.encodeSchema(cond), options)
    return result.map(function (row) {
      return {
        listbill: listbill.decodeSchema(row[`${prefix}_list_bill`]),
        bill: collection.bill.decodeSchema(row[`${prefix}_bill`])
      }
    })
  }

  listbill.findWithList = function *(cond, options) {
    let db = listbill.db
    let prefix = db.prefix
    options = options || {}
    let joins = options.joins || (options.joins = [])
    joins.push({
      type: 'LEFT',
      table: 'list',
      cond: [
        `${prefix}_list.id = ${prefix}_list_bill.list_id`
      ]
    })
    options.nestTables = true
    let result = yield db.find(this.table, listbill.encodeSchema(cond), options)
    return result.map(function (row) {
      return {
        listbill: listbill.decodeSchema(row[`${prefix}_list_bill`]),
        list: collection.list.decodeSchema(row[`${prefix}_list`])
      }
    })
  }

  return listbill
}
