'use strict'

const redis = require('thunk-redis')
const config = require('config')
const debug = require('debug')('redis')
let client = module.exports = redis.createClient(config.redis.port, config.redis.host)

module.exports.bind = function (callback) {
  client.once('connect', function () {
    debug('connected')
    callback()
  })
}

client.on('error', function (error) {
  console.log('redis error', error)
})
