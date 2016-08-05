'use strict'
const path = require('path')
const crypto = require('crypto')
const config = require('config')
const redis = require('../service/redis')
const Err = require('../error')

let contentAPI = module.exports = {}
contentAPI.getPreivewLink = function *() {
  let token = this.token
  let body = yield this.parseBody()

  let contentToken = nonce()
  let key = `PREVIEW:${contentToken}`
  yield redis.setex(key, 86400, JSON.stringify(body))

  let url = config.host + path.join(config.rootAPI, '/preview-data/', contentToken)
  this.body = {
    token: contentToken,
    url: url
  }
}

contentAPI.previewContent = function *() {
  // console.log('list-token', this.params.listToken)
  let key = `PREVIEW:${this.params.contentToken}`
  let content = yield redis.get(key)
  if (!content) throw new Err('not found')
  try {
    content = JSON.parse(content)
  } catch (e) {
    throw new Err('not found')
  }
  this.body = content
  // // if (!list_id) throw new Err('invalid params', 'list_id')
  // let list = yield db.list.load({id: list_id})
  // if (!list) throw new Err('not found', 'list')
  // delete list.id
  // delete list.user_id
  // this.body = list
}

// function * makePreviewToken (content) {
//   return listToken
// }

function nonce () {
  return crypto.randomBytes(16).toString('hex')
}
