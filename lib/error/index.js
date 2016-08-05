'use strict'
// const util = require('util')
const code = require('./code')

function Err (name, params) {
  let info = code[name] || {
    message: 'Unknown Error: ' + name,
    code: 100,
    status: 500
  }

  this.message = typeof info.message === 'function'
    ? info.message(params)
    : info.message
  this.code = info.code
  this.status = info.status
}
module.exports = Err
