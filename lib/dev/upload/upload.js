/*global jQuery WebUploader */
(function ($) {
  $(function () {
    var $filelist = $('#filelist')
    var uploader = WebUploader.create({
      server: './',
      pick: '#picker',
      dnd: '#dndArea',
      paste: '#uploader',
      resize: false
    })

    uploader.on('fileQueued', function (file) {
      $filelist.append(
        $('<li>').attr('data-id', file.id).addClass('item')
          .append($('<h4>').html(file.name))
          .append($('<p>').addClass('status').html('等待上传...'))
      )
      uploader.upload()
    })

    uploader.on('uploadSuccess', function (file, response) {
      var $file = $filelist.find('[data-id=' + file.id + ']')
      $file.find('p.status').text('已上传')
    })

    uploader.on('uploadError', function (file, reason) {
      $filelist.find('[data-id=' + file.id + ']').find('p.status').text('上传出错:' + reason)
    })
  })
})(jQuery)
