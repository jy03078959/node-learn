'use strict'

const XLSX = require('xlsx')
const debug = require('debug')('write-excel')
const moment = require('moment')

const excelColumns = require('../bll/excel-columns')

// module.exports = writeExcel
module.exports = writeExcel
function writeExcel (list, listbills) {
  let cells = []
  let columns = excelColumns(list)
  cells.push(columns.map(function (column) {
    return {v: column.name, t: 's'}
  }))
  listbills.map(function (listbill, r) {
    let bill = listbill.bill
    listbill = listbill.listbill
    let row = []
    columns.map(function (column) {
      let cell
      if (typeof column.value === 'function') {
        cell = column.value(r, list, listbill, bill)
      } else if (column.obj && column.key && column.type) {
        let obj = column.obj === 'bill' ? bill : list
        cell = {
          v: obj[column.key],
          t: column.type
        }
        if (cell.t === 't') {
          cell.v = datenum(cell.v)
          cell.t = 'n'
          cell.z = 'd-mmm-yy'
        }
      }
      row.push(cell)
    })
    cells.push(row)
  })
  let ws = makeWs(cells, columns)
  return makeExcelBuffer('Sheet1', ws)
}

function makeWs (data, columns) {
  let ws = {}
  data.map(function (row, r) {
    row.map(function (cell, c) {
      let cr = XLSX.utils.encode_cell({c: c, r: r})
      ws[cr] = cell
    })
  })
  var range = {s: {c: 0, r: 0}, e: {c: columns.length - 1, r: data.length - 1}}
  ws['!ref'] = XLSX.utils.encode_range(range)
  return ws
}

function makeExcelBuffer (sheetName, ws) {
  var wb = {
    SheetNames: [],
    Sheets: {}
  }
  wb.SheetNames.push(sheetName)
  wb.Sheets[sheetName] = ws
  var buffer = XLSX.write(wb, {type: 'buffer'})
  debug('write length', buffer.length)
  return buffer
}

function datenum (v, date1904) {
  if (date1904) v += 1462
  var epoch = Date.parse(v)
  return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000)
}
