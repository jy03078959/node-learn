'use strict'

const config = require('config')
const mysql = require('mysql')
const debug = require('debug')('mysql')

let pool = module.exports = mysql.createPool({
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.db
})

module.exports.bind = function (callback) {
  pool.getConnection(function (err) {
    if (err) throw err
    debug('connected')
    pool.query('set sql_mode=\'\'', callback)
    // callback()
  })
}
