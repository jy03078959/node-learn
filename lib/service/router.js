'use strict'
const config = require('config')
const Router = require('toa-router')
const User = require('../api/user')

let router = module.exports = new Router(config.rootAPI)

// authorization
router.get('/wechat/login', User.getInfo)
