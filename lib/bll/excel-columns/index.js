'use strict'
const db = require('../../model')
const currentColumns = require('./current')
const futureColumns = require('./future')
module.exports = function (list) {
  if (list.transaction_type === db.list.TRANSACTION_TYPE.BUY ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL) {
    return currentColumns
  } else if (list.transaction_type === db.list.TRANSACTION_TYPE.BUY_RETURN ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL_RETURN) {
    return futureColumns
  } else {
    return currentColumns
    // throw new Error('unknown list type')
  }
}
