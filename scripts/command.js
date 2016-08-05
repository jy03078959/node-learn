'use strict'
const config = require('config')

let methods = {
  token: function (argv) {
    const JWT = require('jsonwebtoken')
    let token = argv[3]
    // let jwt = new JWT(config.secretToken)
    let jwt = JWT
    // var decoded = jwt.sign(token, 'wrong-secret')
    var decoded = jwt.verify(token, config.secretToken)
    console.log(decoded)
  }
}

let argv = process.argv
let method = argv[2]
methods[method](argv)
