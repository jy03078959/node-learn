'use strict'

const Err = require('../error')

let userAPI = module.exports = {}

userAPI.getInfo = function *() {
  let token = this.token
  let user = {
    name:1
  }
  if (!user) throw new Err('not found', 'user')
  this.body = user
}
