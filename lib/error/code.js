'use strict'

module.exports = {
  'invalid params': {
    status: 400,
    code: 100,
    message: function (params) {
      if (!Array.isArray(params)) params = [params]
      return `invalid params: ${params.join(' or ')}`
    }
  },
  'not found': {
    status: 404,
    code: 101,
    message: function (params) {
      if (!Array.isArray(params)) params = [params]
      return `${params.join(' or ')} not found`
    }
  },
  'no email receipt': {
    status: 406,
    code: 102
  },
  'no auth': {
    status: 401,
    code: 102
  }
}
