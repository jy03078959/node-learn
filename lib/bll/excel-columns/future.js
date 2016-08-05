'use strict'
const moment = require('moment')
module.exports = [
  {name: '序号', value: function (r, list, listbill, bill) {
    return {v: r + 1, t: 'n'}
  }},
  {name: '票据类型', value: function (r, list, listbill, bill) {
    let bill_types = {
      0: '纸银',
      1: '纸商',
      2: '电银',
      3: '电商',
      4: '混合'
    }
    return {v: bill_types[bill.bill_type], t: 's'}
  }},
  {name: '票号', obj: 'bill', key: 'bill_number', type: 's'},
  {name: '票面金额', obj: 'bill', key: 'sum', type: 'n'},

  {name: '出票日', value: function (r, list, listbill, bill) {
    return {v: moment(bill.begin_date).format('YYYY-MM-DD'), t: 's'}
  }},
  {name: '到期日', value: function (r, list, listbill, bill) {
    return {v: moment(bill.end_date).format('YYYY-MM-DD'), t: 's'}
  }},
  {name: '回购起息日', value: function (r, list, listbill, bill) {
    return {v: moment(list.transaction_date).format('YYYY-MM-DD'), t: 's'}
  }},
  {name: '回购到期日', value: function (r, list, listbill, bill) {
    return {v: moment(list.future_date).format('YYYY-MM-DD'), t: 's'}
  }},
  {name: '计息天数', value: function (r, list, listbill, bill) {
    return {v: listbill.interest_calculated_days, t: 'n', f: `F${r + 1}-L${r + 1}+K${r + 1}`}
  }},
  {name: '利率%', value: function (r, list, listbill, bill) {
    return {v: list.interest_rate, t: 'n'}
    // return {v: list.interest_rate / 100, t: 'n', z: '0.00%'}
  }},
  {name: '利息', value: function (r, list, listbill, bill) {
    return {v: listbill.interest, t: 'n', f: `D${r + 1}*N${r + 1}/360`}
  }},
  {name: '实付', value: function (r, list, listbill, bill) {
    return {v: listbill.paid, t: 'n', f: `D${r + 1}+O${r + 1}`}
  }},
  {name: '出票人', obj: 'bill', key: 'accept_company', type: 's'},
  {name: '收款人', obj: 'bill', key: 'launch_company', type: 's'},
  {name: '承兑人', obj: 'bill', key: 'accept_bank', type: 's'},
  {name: '承兑人开户行', obj: 'bill', key: 'accept_bank', type: 's'},
  {name: '开户行行号', obj: 'bill', key: 'accept_bank_number', type: 's'}
]
