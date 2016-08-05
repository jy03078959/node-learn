'use strict'

const path = require('path')
const Imap = require('imap')
const Parser = require('imap/lib/Parser')
const fs = require('fs')
const crypto = require('crypto')
const base64 = require('base64-stream')
const config = require('config')
const mkdirp = require('mkdirp')
const debug = require('debug')('imap')
const EventEmitter = require('events').EventEmitter
const util = require('util')

module.exports = Inbox
function Inbox (options) {
  if (!(this instanceof Inbox)) return new Inbox(options)
  EventEmitter.call(this)
  this._options = options = options || {}
  this._options.lastUID = this._options.lastUID || 0
  initOptions(this._options)
  this._imap = new Imap({
    user: this._options.email,
    password: this._options.password,
    host: this._options.imapHost,
    port: this._options.imapPort,
    autotls: 'required',
    tls: !!this._options.tls,
    tlsOptions: { rejectUnauthorized: false }
  })
}
util.inherits(Inbox, EventEmitter)
Inbox.prototype.fetch = function (boxName, mailboxInfo) {
  let self = this
  self.initBox(boxName, function (err) {
    if (err) return self.emit('error', err)
    function fetch () {
      self.fetchOne2(mailboxInfo.minUID, mailboxInfo.maxUID, function (err, mailInfo) {
        if (err) return self.emit('error', err)
        if (!mailInfo) return self.emit('end')
        self.emit('mail', mailInfo)
        fetch()
      })
    }
    fetch()
  })
}

Inbox.prototype.fetchOne2 = function (minUID, maxUID, callback) {
  let self = this
  let isCalled = false
  function _callback (err, result) {
    if (result.attachmentNeedFinish !== result.attachmentRealFinish) return
    if (isCalled) return
    isCalled = true
    delete result.attachmentNeedFinish
    delete result.attachmentRealFinish
    callback(err, result)
  }
  let imap = this._imap
  // let currentUID = this.fetchList.pop()
  let currentUID = getCurrentUID(this.fetchList, minUID, maxUID)
  if (!currentUID) {
    debug('no UID left')
    isCalled = true
    return callback()
  }

  let result = {
    id: currentUID,
    header: {},
    subject: '',
    body: '',
    date: '',
    attachmentNeedFinish: 0,
    attachmentRealFinish: 0,
    attachments: []
  }
  let fetchRange = `${currentUID}:${currentUID}`
  debug('fetch range', fetchRange)
  let fetch = imap.fetch(fetchRange, {
    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
    struct: true
  })
  fetch.on('end', function () {
    _callback(null, result)
  })
  fetch.on('error', function (err) {
    debug('fetch message error', err)
    isCalled = true
    return callback(err)
  })
  fetch.on('message', function (message, seqno) {
    debug('imap fetching message', seqno)
    message.on('body', function (stream) {
      let buffer = ''
      stream.on('data', function (chunk) {
        buffer += chunk.toString('utf8')
      })
      /* header {
        from: [ '"韦博国际英语" <liyou@change.webowelcome.com>' ],
        to: [ '2286346516@qq.com' ],
        subject: [ '最适合职业白领的英文日报，《Hi-English》免费送达（AD）' ],
        date: [ 'Wed, 20 May 2015 01:49:21 +0800' ]
      } */
      stream.once('end', function () {
        var header = Imap.parseHeader(buffer)
        result.header = header
        result.subject = header.subject && header.subject.join(' ')
        result.date = new Date(header.date && header.date.join(' '))
        result.froms = header.from
        result.tos = header.to
      })
    })

    message.on('attributes', function (attrs) {
      result.hasAttachment = true
      let attachments = findAttachmentParts(attrs.struct)
      result.attachmentNeedFinish = attachments.length
      debug('start download attachments', currentUID, attachments.length)
      attachments.map(function (attachment) {
        self.fetchAttachment({
          UID: currentUID,
          attachment: attachment
        }, function (err, fileInfo) {
          if (err) return callback(err)
          result.attachmentRealFinish++
          if (fileInfo) {
            result.attachments.push(fileInfo)
          }
          _callback(err, result)
        })
      })
    })
  })
}

Inbox.prototype.end = function (callback) {
  let imap = this._imap
  imap.end()
}

Inbox.prototype.fetchAttachment = function (attachmentInfo, callback) {
  // let encoding = atta.encoding
  // let self = this
  let imap = this._imap
  let UID = attachmentInfo.UID
  let attachment = attachmentInfo.attachment
  let email = this._options.email

  let filename = attachment.params.name
  let encoding = attachment.encoding.toUpperCase()
  filename = Parser.decodeWords(filename)
  let extname = path.extname(filename)
  if (!/^\.xls(x)?$/.test(extname)) {
    return callback()
  }

  let fileInfo = {
    filename: filename
  }
  debug('start fetch attachment', attachmentInfo)
  let fetch = imap.fetch(UID, {
    bodies: [attachment.partID],
    struct: true
  })

  fetch.on('error', function (err) {
    debug('fetch attachment error', err)
    if (err) callback(err)
  })
  fetch.on('message', function (message) {
    message.on('body', function (stream, info) {
      let filepath = path.resolve(config.attachmentDirectory, email.toString(), UID.toString(), md5(filename) + extname)
      stream.once('end', function () {
        fileInfo.filepath = filepath
        callback(null, fileInfo)
      })

      mkdirp(path.resolve(filepath, '../'), function (err) {
        if (err) return callback(err)
        let writeStream = fs.createWriteStream(filepath)
        debug('imap fetching attachment body', UID, filename, filepath)
        if (encoding === 'BASE64') {
          // the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
          stream.pipe(base64.decode()).pipe(writeStream)
        } else {
          // here we have none or some other decoding streamed directly to the file which renders it useless probably
          stream.pipe(writeStream)
        }
      })
    })
  })
}

Inbox.prototype.initBox = function (boxname, callback) {
  let self = this
  let imap = this._imap
  boxname = boxname || 'INBOX'
  imap.openBox(boxname, true, function (err, box) {
    if (err) return callback(err)
    imap.search(['ALL'], function (err, result) {
      if (err) return callback(err)
      self.fetchList = result
      callback(null, result)
    })
  })
}

Inbox.prototype.init = function (callback) {
  let options = this._options
  let imap = this._imap
  let self = this
  this.fetchList = []

  imap.once('end', function () {
    debug('imap end')
  })

  imap.on('close', function () {
    debug('imap close')
  })

  imap.on('error', function (err) {
    debug('imap error', err)
    // self.emit('error', err)
    callback(err)
  })
  imap.once('ready', function () {
    debug('imap get boxes')
    imap.getBoxes('', function (err, boxes) {
      if (err) return callback(err)
      let boxNames = self.boxNames = Object.keys(boxes)
      debug('imap end get boxNames', boxNames)
      callback(err, boxNames)
    })
  })
  debug('imap connecting', options.imapHost, options.imapPort)
  imap.connect()
}

function initOptions (options) {
  if (options.imapHost && options.imapPort) return
  var hostname = options.email.replace(/^.*@/, '')
  options.imapHost = options.imapPort || `imap.${hostname}`
  options.imapPort = options.imapPort || options.tls ? 993 : 143
}

function findAttachmentParts (struct, attachments) {
  attachments = attachments || []
  for (var i = 0, len = struct.length; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments)
    } else {
      if (struct[i].type === 'application') {
        attachments.push(struct[i])
      }
    }
  }
  return attachments
}

function md5 (message) {
  return crypto.createHash('md5').update(message).digest('hex')
}

function getCurrentUID (fetchList, minUID, maxUID) {
  let length = fetchList.length
  if (maxUID > 0) {
    for (let i = 0; i < length; i++) {
      if (fetchList[i] > maxUID) {
        return fetchList.splice(i, 1)[0]
      }
    }
  }
  for (let i = length; i > 0; i--) {
    if (fetchList[i - 1] < minUID) {
      return fetchList.splice(i - 1, 1)[0]
    }
  }
}
