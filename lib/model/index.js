'use strict'

const mysqlConnection = require('../service/mysql')
const Collection = require('mysql-schema')
const db = new Collection(mysqlConnection, {prefix: 'madpj'})
const names = [
  'user',
  'bank',
  'contact',
  'contract',
  'email',
  'holiday',
  'list',
  'bill',
  'listbill',
  'userbill'
]

names.map(function (name) {
  let schema = require('./' + name)(Collection.Schema, db)
  db.loadSchema(schema)
  db[name] = db.collection(schema.table)
})

module.exports = db
