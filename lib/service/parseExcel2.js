'use strict'

const _ = require('lodash')
const thunk = require('thunks')()
const XLSX = require('xlsx')
const fs = require('fs')
const debug = require('debug')('parseExcel')
const readFile = thunk.thunkify(fs.readFile)
// const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const columnHeaders = {
  bill_number: {key: 'bill_number', type: 'bill', possible_names: ['票号*', '汇票号码', '票据号码', '汇票编号', '票据号']},
  begin_date: {key: 'begin_date', type: 'bill', possible_names: ['出票日', '出票日期', '票据出票日*', '汇票出票日'], value: getCellDatetime},
  end_date: {key: 'end_date', type: 'bill', possible_names: ['到期日', '票面到期日', '汇票到期日', '票据到期日*', '票据到期日', '到期日期', '远期日期'], value: getCellDatetime},
  future_date: {key: 'end_date', type: 'list', possible_names: ['票据回购到期日*', '票据回购到期日', '回购到期日期'], value: getCellDatetime},
  accept_company: {key: 'accept_company', type: 'bill', possible_names: ['出票人', '出票人名称', '出票人/付款人全称', '出票人全称', '出款人']},
  launch_company: {key: 'launch_company', type: 'bill', possible_names: ['收款人', '收款人名称', '收款人全称']},
  sum: {key: 'sum', type: 'bill', possible_names: ['(票面|汇票|票据)?金额((\\(|（)(万)?元(\\)|）))?'], value: getCellRealNumber},
  accept_bank: {key: 'accept_bank', type: 'bill', possible_names: ['承兑行', '承兑人名称', '承兑行/人', '承兑人', '银票承兑银行或商票付款人开户银行', '出票人开户行', '付款行/付款人开户行全称', '兑付行', '出票行', '汇票承兑人', '出票人开户银行', '付款行', '承兑人（行）']},
  accept_bank_number: {key: 'accept_bank_number', type: 'bill', possible_names: ['承兑行号', '承兑银行行号', '行号', '承兑人开户行', '承兑人开户行行号', '承兑行行号', '大额支付号']},

  transaction_date: {key: 'transaction_date', type: 'list', possible_names: ['交易日', '交易日期', '转贴现日', '转贴现交易日', '起息日', '转贴现起息日', '转贴日', '回购起息日'], value: getCellDatetime},
  interest_rate: {key: 'interest_rate', type: 'list', possible_names: ['利率', '利率%', '(月)?利率‰', '交易利率', '转贴现利率', '转贴现利率%', '贴现率', '价格', '年息', '月息', '利率（%）', '利率（‰）'], value: getCellRealNumber},
  interest: {key: 'interest', type: 'list', possible_names: ['利息', '利息金额'], value: getCellRealNumber},
  paid: {key: 'paid', type: 'list', possible_names: ['实付', '实付金额'], value: getCellRealNumber},
  cross_state_day: {key: 'cross_state_day', type: 'list', possible_names: ['异地加天']},
  holiday1: {key: 'holiday1', type: 'list', possible_names: ['到期日星期']},
  holiday2: {key: 'holiday2', type: 'list', possible_names: ['到期日节假日']},
  holiday3: {key: 'holiday3', type: 'list', possible_names: ['节假日加天']},
  interest_add_day: {key: 'interest_add_day', type: 'list', possible_names: ['调整天数']},
  interest_calculated_days: {key: 'interest_calculated_days', type: 'bill', possible_names: ['计息天数']},
  target_name: {key: 'target_name', type: 'list', possible_names: ['交易姓名']},
  target_bank: {key: 'target_bank', type: 'list', possible_names: ['交易银行']},
  // future_date: {key: 'future_date', type: 'list', possible_names: ['远期日期']},
  transaction_type: {key: 'transaction_type', type: 'list', possible_names: ['交易类型']}
}

module.exports = parseExcel
function * parseExcel (file) {
  debug(`start parse ${file}`)
  let buffer = yield readFile(file)
  return parseExcelBuffer(buffer)
}
module.exports.parseExcelBuffer = parseExcelBuffer
function * parseExcelBuffer (buffer) {
  let xlsx = XLSX.read(buffer)

  let result = []
  for (let i in xlsx.SheetNames) {
    let sheetName = xlsx.SheetNames[i]
    try {
      let data = parseSheet(xlsx, sheetName)
      result.push(data)
    } catch (e) {
      debug('parse error', sheetName, e, e.stack)
      result.push(e)
    }
  }
  return result
}

function parseSheet (xlsx, sheetName) {
  let sheet = xlsx.Sheets[sheetName]
  let headerRow = 0
  let headers = {}
  let currentRow = 0
  let rowInfo = {}

  let result = {
    list: {},
    bills: []
  }

  for (let cr in sheet) {
    if (/^!/.test(cr)) continue
    let row = Number(cr.replace(/[A-Za-z]/g, ''))
    let col = cr.replace(/[0-9]/g, '')
    // let colNum = getColumnNumberByString(col)
    let cell = sheet[cr]
    // console.log(headerRow, row, headerRow && headerRow !== row)
    if (headerRow && headerRow !== row) {
      if (currentRow !== row) {
        // console.log(headers)
        if (rowInfo.bill_number) {
          try {
            rowInfo = getBillInfo(rowInfo)
            debug('find bill', rowInfo)
            result.bills.push(rowInfo)
          } catch (e) {
            debug('bill row error', e)
          }
        }
        rowInfo = {}
      }

      currentRow = row
      let colInfo = headers[col]
      if (colInfo) {
        if (colInfo.type === 'bill') {
          rowInfo[colInfo.key] = cellResult(colInfo, cell)
        } else {
          result.list[colInfo.key] = cellResult(colInfo, cell)
        }
      }
    } else {
      for (let colName in columnHeaders) {
        for (let i in columnHeaders[colName].possible_names) {
          let possible_name = columnHeaders[colName].possible_names[i]
          let regex = new RegExp('^' + possible_name.replace(/\*/g, '.*') + '$')
          if (regex.test(cell.v.toString().replace(/\s+/g, ''))) {
            if (!headerRow) debug(`find header row at ${row}`)
            headerRow = row
            headers[col] = _.assign(columnHeaders[colName], {name: cell.v})
            break
          }
        }
      }
    }
  }

  if (rowInfo.bill_number) {
    try {
      rowInfo = getBillInfo(rowInfo)
      debug('find bill', rowInfo)
      result.bills.push(rowInfo)
    } catch (e) {
      debug('bill row error', e)
    }
  }

  debug(`find bill ${result.bills.length} row(s)`)
  if (!result.bills.length) throw new Error('no bill')
  return result
}

// function getColumnNumberByString (col) {
//   let result = 0
//   for (let i = 0; i < col.length; i++) {
//     result += (COLUMNS.indexOf(col[col.length - i - 1]) + 1) * Math.pow(COLUMNS.length, i)
//   }
//   return result
// }

function cellResult (colInfo, cell) {
  if (typeof colInfo.value === 'function') {
    return colInfo.value(colInfo, cell)
  } else {
    return cell.v.toString().trim()
  }
}

function getCellDatetime (colInfo, cell) {
  let result = cell.v
  if (cell.t === 's') {
    if (/^\d+$/.test(result)) {
      result = result.substring(0, result.length - 4) + '-' + result.substring(result.length - 4, result.length - 2) + '-' + result.substring(result.length - 2)
    } else {
      result = result.replace(/[\/\.]+/g, '-')
    }
  } else if (cell.t === 'n') {
    result = (result - 25569) * 86400 * 1000
  }

  if (typeof result === 'string') {
    result = result.replace(/-/g, '/')
  }
  return new Date(result)
}

function getCellRealNumber (colInfo, cell) {
  let result = cell.v
  if (/(万|\b[wW]\b)/.test(colInfo.name)) {
    result *= 10000
  }
  if (/(千|仟|\b[kKqQ]\b)/.test(colInfo.name)) {
    result *= 1000
  }
  if (/(％|%)/.test(colInfo.name)) {
    result *= 0.01
  }
  if (/‰/.test(colInfo.name)) {
    result *= 0.001 * 12
  }
  return result
}

function getBillInfo (bill) {
  bill.bill_type = 6

  if (bill.bill_number.length === 16) {
    switch (bill.bill_number[6]) {
      case '5':
        bill.bill_type = 0
        break
      case '6':
        bill.bill_type = 1
        break
    }
    bill.accept_bank_type = getAcceptBankType(bill.bill_number.substring(0, 3))
  } else if (bill.bill_number.length === 30) {
    switch (bill.bill_number[0]) {
      case '1':
        bill.bill_type = 2
        break
      case '2':
        bill.bill_type = 3
        break
    }
    bill.accept_bank_type = getAcceptBankType(bill.bill_number.substring(1, 4))
  } else {
    throw new Error('bill number error')
  }
  return bill
}

function getAcceptBankType (source) {
  switch (source) {
    case '001': // 001 中国人民银行（国股）
    case '102': // 102 中国工商银行（国股）
    case '103': // 103 中国农业银行（国股）
    case '104': // 104 中国银行（国股）
    case '105': // 105 中国建设银行（国股）
    case '201': // 201 国家开发银行（国股）
    case '202': // 202 中国进出口银行（国股）
    case '203': // 203 中国农业发展银行（国股）
    case '301': // 301 交通银行（国股）
    case '302': // 302 中信银行（国股）
    case '303': // 303 中国光大银行（国股）
    case '304': // 304 华夏银行（国股）
    case '305': // 305 中国民生银行（国股）
    case '306': // 306 广东发展银行（国股）
    case '307': // 307 平安银行（国股）
    case '308': // 308 招商银行（国股）
    case '309': // 309 兴业银行（国股）
    case '310': // 310 上海浦东发展银行（国股）
    case '403': // 403 中国邮政储蓄银行（国股）
      return 0
    case '313': // 313 城市商业银行（城商）
    case '315': // 315 恒丰银行（城商）
    case '316': // 316 浙商银行（城商）
    case '318': // 318 渤海银行（城商）
    case '319': // 319 徽商银行（城商）
    case '321': // 321 重庆三峡银行（城商）
    case '781': // 781 厦门国际银行（城商）
      return 1
    case '322': // 322 上海农村商业银行（农商）
    case '314': // 314 农村商业银行（农商）
      return 2
    case '317': // 317 农村合作银行（农合）
    case '401': // 401 城市信用合作社 （农合）
    case '402': // 402 农村信用合作社（农合）
      return 4
    case '907': // 907 财务集团公司（财务公司）
      return 5
    case '320': // 320 村镇银行（忽略不计）
      return 6
  }
}
