'use strict'
const db = require('../lib/model')
const thunk = require('thunks')()
const moment = require('moment')
const Wechat = require('../lib/service/wechat')

thunk(function *() {
  let today = moment().add(1, 'day')
  let userLists = yield db.list.aggregate({
    'user_id': 'user_id',
    'buy_sell': 'sum(if(transaction_type = 1 or transaction_type = 2, 1, 0))',
    'returned': 'sum(if(transaction_type = 3 or transaction_type = 4, 1, 0))',
    'unknown': 'sum(if(transaction_type = 0, 1, 0))'
  }, {
    'future_date$>=': moment(today).startOf('day').toDate(),
    'future_date$<': moment(today).endOf('day').toDate()
  }, [
    'user_id'
  ])
  let users = yield userLists.map((userList) => db.user.load({id: userList.user_id}))
  yield userLists.map((userList, i) => Wechat.sendMessage(
    users[i],
    `http://open.weixin.qq.com/connect/oauth2/authorize?appid=wx07c7271a9f713a3c&redirect_uri=https%3A%2F%2F5443.funpj.com%2Fwebclient%2Findex.html%23%2Ftrade&response_type=code&scope=snsapi_userinfo&state=123`,
    `您明天有远期交易需要交割`,
    `${userList.buy_sell}笔双买到期 ${userList.returned}笔回购到期`,
    '点击立即处理，确认交易后，可体验极速合同生成服务',
    '点击立即处理或到范票公众号中选择台帐提醒查看',
    moment().add(1, 'day'),
    { onlyDate: true }
  ))
})(function (err) {
  if (err) console.error(err.stack)
  process.exit(0)
})
