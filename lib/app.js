'use strict'

const config = require('config')
const toa = require('toa')
const toaToken = require('toa-token')
const toaBody = require('toa-body')

// const moment = require('moment')
const Err = require('./error')
const thunk = require('thunks')()
// const redis = require('./service/redis')
// const mysql = require('./service/mysql')
const router = require('./service/router')
const info = require('../package.json')

// service launch

let app = toa(function * () {
  this.set('Access-Control-Allow-Origin', '*')
  this.set('Access-Control-Allow-Credentials', 'true')
  this.set('Access-Control-Allow-Origin', this.get('origin') || '*')
  this.set('Access-Control-Allow-Methods', 'GET, POST, PUT, HEAD, OPTIONS, DELETE')
  this.set('Access-Control-Allow-Headers', 'Range, Authorization, Content-Disposition, Content-Length, Content-MD5, Content-Type, X-Requested-With, X-File-Name')
  this.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range')

  yield router.route(this)
}, function (err) {
  if (err instanceof Err) {
    this.status = err.status
    this.body = {
      code: err.code,
      message: err.message
    }
    return true
  } else if (err.status === 401) {
    console.error(err.stack)
  } else if (err.status > 0) {
    this.status = err.status
    this.body = err.message
  } else {
    this.status = 500
    this.body = {code: 100, message: 'Internal Server Error'}
    if (process.env.NODE_ENV === 'development') {
      this.body.error = err.toString()
      this.body.stack = err.stack
    }
    console.error(new Date().toISOString(), err, err.stack)
    return true
  }
})

app.use(function *() {
  let reqStart = Date.now()
  this.on('end', function () {
    let ip = this.headers['x-forwarded-for'] || this.ip
    console.log(new Date().toISOString(), ip, this.method, this.url, this.status, Date.now() - reqStart)
  })
})

toaBody(app)
/*toaToken(app, config.secretToken, {
  getToken: function () {
    return this.cookies.get('PJ_SESSION') || this.query.sign
  }
})*/
thunk.all([
  // redis.bind,
  // mysql.bind
])(function (err) {
  if (err) throw err
  app.listen(config.port, function () {
    console.log(`${info.name} @ ${info.version} start. Listen ${config.port} ...`)
  })
})
