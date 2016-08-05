'use strict'
const urllib = require('urllib')
const config = require('config')
// db = require('limbo').use('teambition')
// ilog = require('ilog')

const sms_url = 'https://sms.yunpian.com/v1/sms/send.json'
const sms_tpl_url = 'https://sms.yunpian.com/v1/sms/tpl_send.json'
const sms_status_url = 'https://sms.yunpian.com/v1/sms/pull_status.json'
// const apikey = config.yunpian.api_key
const sms_sign = config.yunpian.sms_sign || ' 【YUNPIAN】'

module.exports.sendText = sendText
module.exports.send = sendText
function * sendText (phone, text) {
  let data = {
    apikey: config.yunpian.api_key,
    mobile: phone,
    text: sms_sign + text
  }
  let response = yield urllib.requestThunk(sms_url, {
    method: 'POST',
    dataType: 'json',
    data: data
  })
  response = response.data
  if (response.code !== 0) throw new Error(response.message || response)
  return response
}

module.exports.getLog = getLog
function * getLog () {
  let data = {
    apikey: config.yunpian.api_key
  }
  let response = yield urllib.requestThunk(sms_status_url, {
    method: 'POST',
    data: data,
    dataType: 'json'
  })
  if (response.code !== 0) throw new Error(response.message || response)
  if (!Array.isArray(response.sms_status)) throw new Error('sms_status is not an array')
  response.sms_status.map(function (sms) {
    console.log(sms)
  })
}
