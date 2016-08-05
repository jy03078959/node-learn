'use strict'
const path = require('path')
const child_process = require('child_process')
const config = require('config')

const convertXls = function (xlsxFile) {
  return function (callback) {
    let dir = path.resolve(xlsxFile, '../')
    xlsxFile = xlsxFile.substring(dir.length + 1)
    let cmd = ['cd', dir, '&&', config.soffice, '--headless --invisible --convert-to "xls:MS Excel 97"', xlsxFile].join(' ')
    child_process.exec(cmd, function (err, stdout, stderr) {
      if (err) return callback(err)
      if (stderr) return callback(new Error(stderr))
      callback()
    })
  }
}
const parseXls = function (xlsFile, sheet) {
  return function (callback) {
    let dir = path.resolve(xlsFile, '../')
    xlsFile = xlsFile.substring(dir.length + 1)
    let cmd = ['cd', dir, '&&', config.extraBillListExec, xlsFile, sheet].join(' ')
    child_process.exec(cmd, function (err, stdout, stderr) {
      if (err) return callback(err)
      if (stderr) return callback(new Error(stderr))
      let result
      try {
        result = JSON.parse(stdout)
      } catch (e) {
        return callback(e)
      }
      if (!result || !result.bill_list || !Array.isArray(result.bill_list)) callback(new Error('bill_list is not a Array'))
      callback(null, result.bill_list)
    })
  }
}

module.exports = parseExcel
function * parseExcel (filepath) {
  if (path.extname(filepath) === '.xlsx') {
    try {
      yield convertXls(filepath)
      filepath = filepath.replace(/\.xlsx$/, '.xls')
    } catch (e) {
      console.log('convert error')
      console.error(e, e.stack)
      throw e
      // continue
    }
  }

  // parse xls file
  let xlsData
  try {
    xlsData = yield parseXls(filepath, 0)
  } catch (e) {
    console.log('parseXls error')
    console.error(e, e.stack)
    throw e
  }
  if (!xlsData || !xlsData.length) throw new Error('no bills')

  let result = {
    list: {
      transaction_date: new Date(xlsData[0].data.transaction_date),
      interest_rate: Number(xlsData[0].data.interest_rate / 100)
    },
    bills: xlsData.map(function (_bill) {
      let data = _bill.data
      return {
        bill_number: String(data.bill_number),
        sum: Number(data.sum),
        bill_type: Number(data.bill_type),
        accept_bank_type: Number(data.accept_bank_type),
        begin_date: new Date(data.bill_begin_date),
        end_date: new Date(data.bill_end_date),
        launch_company: String(data.launch_company),
        accept_company: String(data.accept_company),
        accept_bank_number: String(data.accept_bank_number),
        accept_bank: String(data.accept_bank)
      }
    })
  }

  return result // /...
}
