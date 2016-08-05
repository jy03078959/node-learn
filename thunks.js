var thunk = require('thunks')()
thunk.seq([
  function (callback) {
    setTimeout(function () {
      callback(null, 'a', 'b')
    }, 100)
    return 'cc'
  },
  thunk(function (callback) {
    callback(null, 'c')
  }),
  [thunk('d'), thunk('e')], // thunk in array will be excuted in parallel
  function (callback) {
   callback(null,'g')
  }
])(function (error, value) {
  console.log(error, value) // null [['a', 'b'], 'c', ['d', 'e'], 'f']
})