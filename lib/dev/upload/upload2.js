/*global $, WebUploader*/
var $wrap = $('#uploader')
var $statusBar = $wrap.find('.statusBar')
var $info = $statusBar.find('.info')
var $upload = $wrap.find('.uploadBtn')
var $placeHolder = $wrap.find('.placeholder')

var $progress = $statusBar.find('.progress').hide()
var fileCount = 0
var fileSize = 0
var state = 'pedding'
var percentages = {}
var uploader

// 实例化
uploader = WebUploader.create({
  pick: {
    id: '#filePicker',
    label: '点击选择图片'
  },
  dnd: '#dndArea',
  paste: '#uploader',
  chunked: false,
  chunkSize: 512 * 1024,
  server: '/upload',

  disableGlobalDnd: true,
  fileNumLimit: 300
})

// 添加“添加文件”的按钮，
uploader.addButton({
  id: '#filePicker2',
  label: '继续添加'
});

// 当有文件添加进来时执行，负责view的创建
function addFile (file) {
  var $li = $(
    '<li id="' + file.id + '">' +
    '<p class="title">' + file.name + '</p>' +
    '<p class="imgWrap"></p>' +
    '<p class="progress"><span></span></p>' +
    '</li>')

  var $btns = $(
    '<div class="file-panel">' +
    '<span class="cancel">删除</span>' +
    '<span class="rotateRight">向右旋转</span>' +
    '<span class="rotateLeft">向左旋转</span></div>').appendTo($li)
  var $prgress = $li.find('p.progress span')
  var $wrap = $li.find('p.imgWrap')
  var $info = $('<p class="error"></p>')

  var showError = function (code) {
    $info.text(code || 'failure').appendTo($li)
  }

  if (file.getStatus() === 'invalid') {
    showError(file.statusText)
  } else {
    percentages[ file.id ] = [ file.size, 0 ]
  }

  file.on('statuschange', function(cur, prev) {
    if (prev === 'progress') {
      $prgress.hide().width(0)
    } else if (prev === 'queued') {
      $li.off('mouseenter mouseleave');
      $btns.remove();
    }

        // 成功
        if (cur === 'error' || cur === 'invalid') {
            console.log(file.statusText);
            showError(file.statusText);
            percentages[ file.id ][ 1 ] = 1;
        } else if (cur === 'interrupt') {
            showError('interrupt');
        } else if (cur === 'queued') {
            percentages[ file.id ][ 1 ] = 0;
        } else if (cur === 'progress') {
            $info.remove();
            $prgress.css('display', 'block');
        } else if (cur === 'complete') {
            $li.append('<span class="success"></span>');
        }

        $li.removeClass('state-' + prev).addClass('state-' + cur);
    });

    $li.on('mouseenter', function() {
        $btns.stop().animate({height: 30});
    });

    $li.on('mouseleave', function() {
        $btns.stop().animate({height: 0});
    });

    $btns.on('click', 'span', function() {
        var index = $(this).index(),
            deg;

        switch (index) {
            case 0:
                uploader.removeFile(file);
                return;

            case 1:
                file.rotation += 90;
                break;

            case 2:
                file.rotation -= 90;
                break;
        }

        if (supportTransition) {
            deg = 'rotate(' + file.rotation + 'deg)';
            $wrap.css({
                '-webkit-transform': deg,
                '-mos-transform': deg,
                '-o-transform': deg,
                'transform': deg
            });
        } else {
            $wrap.css('filter', 'progid:DXImageTransform.Microsoft.BasicImage(rotation='+ (~~((file.rotation/90)%4 + 4)%4) +')');
            // use jquery animate to rotation
            // $({
            //     rotation: rotation
            // }).animate({
            //     rotation: file.rotation
            // }, {
            //     easing: 'linear',
            //     step: function(now) {
            //         now = now * Math.PI / 180;

            //         var cos = Math.cos(now),
            //             sin = Math.sin(now);

            //         $wrap.css('filter', "progid:DXImageTransform.Microsoft.Matrix(M11=" + cos + ",M12=" + (-sin) + ",M21=" + sin + ",M22=" + cos + ",SizingMethod='auto expand')");
            //     }
            // });
        }


    });

    $li.appendTo($queue);
}

// 负责view的销毁
function removeFile(file) {
    var $li = $('#'+file.id);

    delete percentages[ file.id ];
    updateTotalProgress();
    $li.off().find('.file-panel').off().end().remove();
}

function updateTotalProgress() {
    var loaded = 0,
        total = 0,
        spans = $progress.children(),
        percent;

    $.each(percentages, function(k, v) {
        total += v[ 0 ];
        loaded += v[ 0 ] * v[ 1 ];
    });

    percent = total ? loaded / total : 0;


    spans.eq(0).text(Math.round(percent * 100) + '%');
    spans.eq(1).css('width', Math.round(percent * 100) + '%');
    updateStatus();
}

function updateStatus() {
    var text = '', stats;

    if (state === 'ready') {
        text = '选中' + fileCount + '张图片，共' +
                WebUploader.formatSize(fileSize) + '。';
    } else if (state === 'confirm') {
        stats = uploader.getStats();
        if (stats.uploadFailNum) {
            text = '已成功上传' + stats.successNum+ '张照片至XX相册，'+
                stats.uploadFailNum + '张照片上传失败，<a class="retry" href="#">重新上传</a>失败图片或<a class="ignore" href="#">忽略</a>'
        }

    } else {
        stats = uploader.getStats();
        text = '共' + fileCount + '张（' +
                WebUploader.formatSize(fileSize)  +
                '），已上传' + stats.successNum + '张';

        if (stats.uploadFailNum) {
            text += '，失败' + stats.uploadFailNum + '张';
        }
    }

    $info.html(text);
}

function setState(val) {
    var file, stats;

    if (val === state) {
        return;
    }

    $upload.removeClass('state-' + state);
    $upload.addClass('state-' + val);
    state = val;

    switch (state) {
        case 'pedding':
            $placeHolder.removeClass('element-invisible');
            $queue.hide();
            $statusBar.addClass('element-invisible');
            uploader.refresh();
            break;

        case 'ready':
            $placeHolder.addClass('element-invisible');
            $('#filePicker2').removeClass('element-invisible');
            $queue.show();
            $statusBar.removeClass('element-invisible');
            uploader.refresh();
            break;

        case 'uploading':
            $('#filePicker2').addClass('element-invisible');
            $progress.show();
            $upload.text('暂停上传');
            break;

        case 'paused':
            $progress.show();
            $upload.text('继续上传');
            break;

        case 'confirm':
            $progress.hide();
            $('#filePicker2').removeClass('element-invisible');
            $upload.text('开始上传');

            stats = uploader.getStats();
            if (stats.successNum && !stats.uploadFailNum) {
                setState('finish');
                return;
            }
            break;
        case 'finish':
            stats = uploader.getStats();
            if (stats.successNum) {
                alert('上传成功');
            } else {
                // 没有成功的图片，重设
                state = 'done';
                location.reload();
            }
            break;
    }

    updateStatus();
}

uploader.onUploadProgress = function(file, percentage) {
    var $li = $('#'+file.id),
        $percent = $li.find('.progress span');

    $percent.css('width', percentage * 100 + '%');
    percentages[ file.id ][ 1 ] = percentage;
    updateTotalProgress();
};

uploader.onFileQueued = function(file) {
    fileCount++;
    fileSize += file.size;

    if (fileCount === 1) {
        $placeHolder.addClass('element-invisible');
        $statusBar.show();
    }

    addFile(file);
    setState('ready');
    updateTotalProgress();
};

uploader.onFileDequeued = function(file) {
    fileCount--;
    fileSize -= file.size;

    if (!fileCount) {
        setState('pedding');
    }

    removeFile(file);
    updateTotalProgress();

};

uploader.on('all', function(type) {
    var stats;
    switch(type) {
        case 'uploadFinished':
            setState('confirm');
            break;

        case 'startUpload':
            setState('uploading');
            break;

        case 'stopUpload':
            setState('paused');
            break;

    }
});

uploader.onError = function(code) {
    alert('Eroor: ' + code);
};

$upload.on('click', function() {
    if ($(this).hasClass('disabled')) {
        return false;
    }

    if (state === 'ready') {
        uploader.upload();
    } else if (state === 'paused') {
        uploader.upload();
    } else if (state === 'uploading') {
        uploader.stop();
    }
});

$info.on('click', '.retry', function() {
    uploader.retry();
});

$info.on('click', '.ignore', function() {
    alert('todo');
});

$upload.addClass('state-' + state);
updateTotalProgress();
