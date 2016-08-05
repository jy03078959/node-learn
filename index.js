/**
 * Created with WebStorm.
 * User: stoneship
 * Email:258137678@qq.com
 * Date: 16/7/28
 * Time: 下午10:11
 * To change this template use File | Settings | File Templates.
 */

var Toa = require('toa')
var config = require('config')
const Router = require('toa-router')
var router = new Router(config.rootAPI)
const info = require('./package.json')
// root
router.get('/', function * () {
  this.body = {
    name: 'funpj API',
    version: info.version
  }
})
router.get('/wechat/login', function * (){
  var token = this.token
  var user = {
    name:1
  }
  if (!user) throw new Err('not found', 'user')
  this.body = user
})
// with full arguments
var http = require('http');

var server = http.createServer()
var app = new Toa(server, function * () {
  this.body = 'Hello World!\n-- toa'
  yield router.route(this)
}, {
  debug: function () {},
  onstop: function (sig) {},
  onerror: function (error) {}
})
app.listen(config.port, function () {
  console.log(`${info.name} @ ${info.version} start. Listen ${config.port} ...`)
})
