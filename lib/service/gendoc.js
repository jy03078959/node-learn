'use strict'
const fs = require('fs')
const thunk = require('thunks')()
const config = require('config')
const moment = require('moment')
const exec = require('child_process').exec
const execThunk = thunk.thunkify(exec)
const crypto = require('crypto')
const path = require('path')
const db = require('../model')

module.exports = function * getContractStream (contract) {
  let list = yield db.list.load({id: contract.list_id})
  let data = getData(contract, list)
  let filename = path.resolve(config.tmpDirectory, createRandomName())
  let type = data.type
  let template = data.template
  delete data.type
  delete data.template
  let cmd = `python ${config.gendocPython} '${JSON.stringify(data)}' ${type} ${config.gendocPythonPath}/${template} -o ${filename}`
  yield execThunk(cmd)
  return fs.createReadStream(filename)
  // return filename
}

function createRandomName () {
  return '' + new Date().getTime() + crypto.createHash('md5').update(crypto.randomBytes(16)).digest('hex')
}

function getData (contract, list) {
  if (
    list.bill_type === db.list.BILL_TYPE.ZHI_YIN &&
    (list.transaction_type === db.list.TRANSACTION_TYPE.BUY ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL)) {
    return {
      type: 0,
      part_a: contract.extra.buyer.name,
      part_b: contract.extra.saler.name,
      num_bill: String(list.total_bill_num),
      sum: String(list.total_sum.toFixed(2)),
      rate: fixRate(list.interest_rate),
      account_name_b: contract.extra.saler.account_name,
      deposit_bank_b: contract.extra.saler.bank_name,
      deposit_bank_number_b: contract.extra.saler.bank_number,
      account_number_b: contract.extra.saler.account_number,
      pay_system_number_b: contract.extra.saler.bank_number,
      transaction_date: moment(list.transaction_date).format('YYYY-MM-DD'),
      template: 'template/纸银买卖断合同.docx'
    }
  } else if (
    list.bill_type === db.list.BILL_TYPE.ZHI_SHANG &&
    (list.transaction_type === db.list.TRANSACTION_TYPE.BUY ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL)) {
    return {
      type: 1,
      part_a: contract.extra.buyer.name,
      part_b: contract.extra.saler.name,
      num_bill: String(list.total_bill_num),
      sum: String(list.total_sum.toFixed(2)),
      paid: list.total_paid,
      rate: fixRate(list.interest_rate),
      account_name_b: contract.extra.saler.account_name,
      deposit_bank_b: contract.extra.saler.bank_name,
      deposit_bank_number_b: contract.extra.saler.bank_number,
      account_number_b: contract.extra.saler.account_number,
      pay_system_number_b: contract.extra.saler.bank_number,
      transaction_date: moment(list.transaction_date).format('YYYY-MM-DD'),
      template: 'template/纸商买卖断合同.docx'
    }
  } else if (
    (list.bill_type === db.list.BILL_TYPE.DIAN_YIN ||
    list.bill_type === db.list.BILL_TYPE.DIAN_SHANG) &&
    (list.transaction_type === db.list.TRANSACTION_TYPE.BUY ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL)) {
    return {
      type: 2,
      part_a: contract.extra.buyer.name,
      part_b: contract.extra.saler.name,
      num_bill: String(list.total_bill_num),
      sum: String(list.total_sum.toFixed(2)),
      rate: fixRate(list.interest_rate),
      account_name_b: contract.extra.saler.account_name,
      deposit_bank_b: contract.extra.saler.bank_name,
      deposit_bank_number_b: contract.extra.saler.bank_number,
      account_number_b: contract.extra.saler.account_number,
      pay_system_number_b: contract.extra.saler.bank_number,
      transaction_date: moment(list.transaction_date).format('YYYY-MM-DD'),
      template: 'template/电子商业汇票买卖断合同.docx'
    }
  } else if (
    (list.bill_type === db.list.BILL_TYPE.DIAN_YIN ||
    list.bill_type === db.list.BILL_TYPE.DIAN_SHANG) &&
    (list.transaction_type === db.list.TRANSACTION_TYPE.BUY_RETURN ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL_RETURN)) {
    return {
      type: 4,
      part_a: contract.extra.buyer.name,
      part_b: contract.extra.saler.name,
      num_bill: String(list.total_bill_num),
      sum: String(list.total_sum.toFixed(2)),
      rate: fixRate(list.interest_rate),
      account_name_a: contract.extra.buyer.account_name,
      account_name_b: contract.extra.saler.account_name,
      account_number_a: contract.extra.buyer.account_number,
      account_number_b: contract.extra.saler.account_number,
      deposit_bank_a: contract.extra.buyer.bank_name,
      deposit_bank_b: contract.extra.saler.bank_name,
      deposit_bank_number_a: contract.extra.buyer.bank_number,
      deposit_bank_number_b: contract.extra.saler.bank_number,
      redemption_date: moment(list.future_date).format('YYYY-MM-DD'),
      pay_system_number_a: contract.extra.buyer.bank_number,
      pay_system_number_b: contract.extra.saler.bank_number,
      endorsee: '被背书人',
      transaction_date: moment(list.transaction_date).format('YYYY-MM-DD'),
      end_date: moment(list.future_date).format('YYYY-MM-DD'),
      template: 'template/电票回购合同.docx'
    }
  } else if (
    (list.bill_type === db.list.BILL_TYPE.ZHI_YIN ||
    list.bill_type === db.list.BILL_TYPE.ZHI_SHANG) &&
    list.transaction_type === db.list.TRANSACTION_TYPE.BUY_RETURN ||
    list.transaction_type === db.list.TRANSACTION_TYPE.SELL_RETURN) {
    return {
      type: 3,
      part_a: contract.extra.buyer.name,
      part_b: contract.extra.saler.name,
      num_bill: String(list.total_bill_num),
      sum: String(list.total_sum.toFixed(2)),
      rate: fixRate(list.interest_rate),
      account_name_a: contract.extra.buyer.account_name,
      account_name_b: contract.extra.saler.account_name,
      account_number_a: contract.extra.buyer.account_number,
      account_number_b: contract.extra.saler.account_number,
      deposit_bank_a: contract.extra.buyer.bank_name,
      deposit_bank_b: contract.extra.saler.bank_name,
      deposit_bank_number_a: contract.extra.buyer.bank_number,
      deposit_bank_number_b: contract.extra.saler.bank_number,
      pay_system_number_a: contract.extra.buyer.bank_number,
      pay_system_number_b: contract.extra.saler.bank_number,
      endorsee: '被背书人',
      transaction_date: moment(list.transaction_date).format('YYYY-MM-DD'),
      end_date: moment(list.future_date).format('YYYY-MM-DD'),
      template: 'template/纸银回购合同.docx'
    }
  } else {
    throw new Error('not support contract type or list type')
  }
}

function fixRate (rate) {
  rate = String(rate)
  let tmp = rate.split('.')
  let main = tmp[0]
  let left = tmp[1] || ''
  while (left.length - 2 < 0) {
    left += '0'
  }
  return [main, left].join('.')
}
