'use strict'
module.exports = function (Schema) {
  let holiday = new Schema('holiday', {
    id: Schema.types.number,
    status: Schema.types.number,
    description: Schema.types.string,
    holiday_time: Schema.types.date,
    update_time: Schema.types.date,
    extra: Schema.types.json
  })

  holiday.STATUS_TYPE = {
    OFF: 0,
    ON: 1
  }

  return holiday
}
