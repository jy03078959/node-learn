'use strict'

const mailcomposer = require('mailcomposer')
const Mailgun = require('mailgun').Mailgun
const Mailgun2 = require('mailgun-js')
const mimeTypes = require('mime-types')
const config = require('config')
const thunk = require('thunks')()
const urllib = require('urllib')
const crypto = require('crypto')

let mailgun = new Mailgun(config.mailgun.api_key)
let mailgun2 = Mailgun2({apiKey: config.mailgun.api_key, domain: 'funpj.com'})
let mg = module.exports = {}

mg.sendRaw = thunk.thunkify(mailgun.sendRaw.bind(mailgun))

mg.send = function *(options) {
  options = options || {}
  options.attachments = options.attachments || []

  if (!options.to) throw new Error('not found a target')
  if (!Array.isArray(options.attachments)) throw new Error('attachments should be an array')

  options.from = options.from || config.mailgun.from
  let mail = mailcomposer({
    from: options.from,
    sender: options.from,
    to: options.to,
    subject: options.title,
    html: options.content,
    attachments: options.attachments.map(function (attachment) {
      return {
        filename: attachment.filename,
        content: attachment.stream,
        contentType: mimeTypes.lookup(attachment.filename)
      }
    })
  })

  mail = yield mail.build.bind(mail)
  return yield mg.sendRaw(options.from, options.to, mail)
}

mg.send2 = function *(options) {
  options = options || {}
  options.attachments = options.attachments || []

  if (!options.to) throw new Error('not found a target')
  if (!Array.isArray(options.attachments)) throw new Error('attachments should be an array')

  options.from = options.from || config.mailgun.from

  let data = {
    from: options.from || '',
    to: options.to || '',
    subject: options.title || '',
    html: options.content || '',
    attachment: options.attachments.map(function (attachment) {
      return new mailgun2.Attachment({
        data: attachment.stream,
        filename: attachment.filename
      })
    })
  }
  let m = mailgun2.messages()
  return yield thunk.thunkify(m.send).call(m, data)
}

mg.fetch = function *(url, options) {
  options = options || {}
  let resp = yield urllib.request(url, {
    auth: `api:${config.mailgun.api_key}`,
    timeout: options.timeout || 15000
  })
  return resp
}

mg.verify = function (body) {
  let signature = body.signature
  let hmac = crypto.createHmac('sha256', config.mailgun.api_key)
  let localSignature = hmac.update(`${body.timestamp}${body.token}`).digest('hex')
  return signature === localSignature
}
