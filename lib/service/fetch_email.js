'use strict'
const debug = require('debug')('fetch-email')
const thunk = require('thunks')()
const db = require('../model')
const Imap = require('./imap')
const redis = require('./redis')
const parseExcelFile = require('./parseExcel2')
const importList = require('./importList')
const Stream = require('thunk-stream')
const processList = []

function * fetchBillListByEmail3 (emailInfo, boxName, inbox) {
  let iotype = getIoTypeByBoxName(boxName)

  let extra = emailInfo.extra || {}
  let mailbox = extra.mailbox = extra.mailbox || {}
  let mailboxInfo = mailbox[boxName] = mailbox[boxName] || {}
  mailboxInfo.minUID = mailboxInfo.minUID || Infinity
  mailboxInfo.maxUID = mailboxInfo.maxUID || 0

  debug('fetch box', boxName, mailboxInfo)
  inbox.fetch(boxName, mailboxInfo)

  inbox.on('mail', function (mailInfo) {
    thunk(function *() {
      if (mailInfo.id < mailboxInfo.minUID) mailboxInfo.minUID = mailInfo.id
      if (mailInfo.id > mailboxInfo.maxUID) mailboxInfo.maxUID = mailInfo.id
      yield db.email.update(emailInfo.id, {
        fetch_time: new Date(),
        extra: extra
      })

      yield fetchAttachments(mailInfo, emailInfo, iotype)
    })(function (err) {
      if (err) console.log('fetch email error', err)
    })
  })

  inbox.once('error', function (error) {
    throw error
  })

  yield Stream(inbox)
  inbox.removeAllListeners('error')
  inbox.removeAllListeners('mail')
}

function * fetchAttachments (mailInfo, emailInfo, iotype) {
  debug('fetch one', mailInfo)
  let attachments = mailInfo.attachments
  if (attachments && attachments.length) {
    for (let i in attachments) {
      try {
        let filepath = attachments[i].filepath
        let fileData = yield parseExcelFile(filepath)
        for (let j in fileData) {
          if (fileData[j] instanceof Error) continue
          yield importList(emailInfo.user_id, fileData[j], {
            target: iotype === 'out' ? mailInfo.tos.join(' ') : mailInfo.froms.join(' '),
            subject: mailInfo.subject,
            body: mailInfo.body,
            date: mailInfo.date,
            filename: `${attachments[i].filename}[${j}]`,
            iotype: iotype
          })
        }
      } catch (e) {
        console.error(e, e.stack, mailInfo)
        continue
      }
    }
  }
}

function getIoTypeByBoxName (boxName) {
  if (/(sen(d|t)|发)/i.test(boxName)) return 'out'
  if (boxName === 'INBOX') return 'in'
  return 'in'
}

function getSentBoxName (boxNames) {
  for (let i in boxNames) {
    let boxName = boxNames[i]
    if (/(sen(d|t)|发)/i.test(boxName)) return boxName
  }
  throw new Error('no sent box name')
}

module.exports.initFetch = initFetch
function * initFetch (emailInfo) {
  yield lock(emailInfo)
  let extra = emailInfo.extra || {}
  let inbox = new Imap({
    email: emailInfo.email,
    password: emailInfo.password,
    tls: extra.tls !== false
  })
  try {
    yield inbox.init.bind(inbox)
  } catch (e) {
    extra.last_fail_time = new Date()
    extra.last_fail_reason = e.message
    yield db.email.update(emailInfo.id, {
      status: db.email.STATUS_TYPE.INVALID,
      extra: extra
    })
    // TODO: release lock
    yield releaseLock(emailInfo)
    throw e
  }
  getSentBoxName(inbox.boxNames)
  return inbox
}

module.exports.fetchEmail = fetchEmail
function * fetchEmail (emailInfo, inbox) {
  debug('start fetch', emailInfo.email)
  let extra = emailInfo.extra || {}
  yield db.email.update(emailInfo.id, {status: db.email.STATUS_TYPE.FETCHING})
  try {
    let sentBoxName = getSentBoxName(inbox.boxNames)
    yield fetchBillListByEmail3(emailInfo, 'INBOX', inbox)
    yield fetchBillListByEmail3(emailInfo, sentBoxName, inbox)
    yield db.email.update(emailInfo.id, {
      status: db.email.STATUS_TYPE.NORMAL
    })
    inbox.end()
    // TODO: release lock
    yield releaseLock(emailInfo)
  } catch (e) {
    extra.last_fail_time = new Date()
    extra.last_fail_reason = e.message
    yield db.email.update(emailInfo.id, {
      status: db.email.STATUS_TYPE.INVALID,
      extra: extra
    })
    // TODO: release lock
    yield releaseLock(emailInfo)
  }
}

function * lock (emailInfo) {
  // let key = 'FETCH_EMAIL:SET'
  // let value = `${emailInfo.user_id}.${emailInfo.email}`
  // let result = yield redis.sadd(key, value)
  // if (result > 0) throw new Error('email locked')
}

function * releaseLock (emailInfo) {
  let key = 'FETCH_EMAIL:SET'
  let value = `${emailInfo.user_id}.${emailInfo.email}`
  yield redis.srem(key, value)
}

// TODO: 用户无法中断，暂时不加
// function startFetchSet () {
//   thunk(function *() {
//   })(function (err) {
//     if (err) console.log('start fetch error', err)
//   })
// }
