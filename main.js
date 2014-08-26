var host = 'https://upload.gyazo.com/api/upload/easy_auth';
var clientId = 'df9edab530e84b4c56f9fcfa209aff1131c7d358a91d85cc20b9229e515d67dd';
var UploadNotification = function(callback) {
  this.progress = 3;
  this.limitValues = [30, 80];
  this.limitLevel = 0;
  this.limit = this.limitValues[this.limitLevel];
  this.nextLimit = function() {
    if(this.limitValues[++this.limitLevel]) {
      this.limit = this.limitValues[this.limitLevel];
    }else {
      this.limit = this.limitValues[--this.limitLevel];
    }
  };
  this.id = 'gyazo_notification_' + Date.now();
  this.newTabId = null;
  this.progressIncrement = function(callback) {
    const INCREMENT_SIZE = 5;
    this.progress = Math.min(this.progress + INCREMENT_SIZE, this.limit);
    this.update({progress: this.progress},callback);
  };
  this.update = function(opt, callback) {
    callback = callback || function(){};
    chrome.notifications.update(this.id, opt, callback);
  };
  this.finish = function(callback) {
    var self = this;
    this.update({
      title: chrome.i18n.getMessage('uploadingFinishTitle'),
      message: chrome.i18n.getMessage('uploadingFinishMessage'),
      progress: 100
    },function(){
      window.setTimeout(function() {
        chrome.notifications.clear(self.id);
      },1200);
    });
  };
  callback = callback || function(){};
  chrome.notifications.create(this.id, {
    type: 'progress',
    title: chrome.i18n.getMessage('uploadingTitle'),
    message: chrome.i18n.getMessage('uploadingMessage'),
    progress: this.progress,
    iconUrl: 'icon128.png',
    priority: 2
  }, callback);
};

function postToGyazo(data, title, url) {
  var notification =  new UploadNotification();
  var timerId = window.setInterval(function() {
    notification.progressIncrement();
    if(notification.newTabId) {
      chrome.tabs.get(notification.newTabId,function(newTab) {
        if(newTab.status === 'complete') {
          notification.finish();
          window.clearInterval(timerId);
        }
      });
    }
  },500);
  $.ajax({
    type: 'POST',
    url: host,
    data: {
      client_id: clientId,
      url: data,
      title: title,
      referer: url
    },
    crossDomain: true
  })
    .done(function(data) {
      chrome.tabs.create({url:data.get_image_url, selected:false}, function(newTab){
        notification.nextLimit();
        notification.newTabId = newTab.id;
        var handler = function (tabId, changeInfo) {
          if (newTab.id === tabId && changeInfo.url) {
            saveToClipboard(changeInfo.url);
            chrome.tabs.onUpdated.removeListener(handler);
            notification.newTabId = tabId;
          }
        };
        chrome.tabs.onUpdated.addListener(handler);
      });
    })
    .fail(function(XMLHttpRequest, textStatus, errorThrown) {
      window.alert('Status: ' + XMLHttpRequest.status + '\n Error: ' + textStatus + '\n Message: '+ errorThrown.message);
    });
}

function onClickHandler(info, tab) {

  var GyazoFuncs = {gyazoIt: function() {
    var xhr = jQuery.ajaxSettings.xhr();
    xhr.open('GET', info.srcUrl, true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = function() {
      if(xhr.readyState === 4){
        var blob = xhr.response;
        var fileReader = new FileReader();
        fileReader.onload = function(e) {
          postToGyazo(fileReader.result, tab.title, tab.url);
        };
        fileReader.readAsDataURL(blob);
      }
    };
    xhr.send();
  },
  gyazoCapture: function() {
    chrome.tabs.sendMessage(tab.id, {action: 'gyazoCapture'}, function(mes){});
  }
};
if(info.menuItemId in GyazoFuncs) {
  GyazoFuncs[info.menuItemId]();
}
}

chrome.contextMenus.onClicked.addListener(onClickHandler);

chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    'title': 'Gyazo It',
    'id': 'gyazoIt',
    'contexts': ['image']
  });
  chrome.contextMenus.create({
    'title': 'Capture',
    'id': 'gyazoCapture'
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(request.action === 'gyazoCaptureSize') {
    chrome.tabs.captureVisibleTab(null,function(data) {
      var d = request.data;
      var canvas = document.createElement('canvas');
      canvas.width = d.w;
      canvas.height = d.h;
      var ctx = canvas.getContext('2d');
      var img = new Image();
      img.addEventListener('load',function() {
        ctx.drawImage(img, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h);
        postToGyazo(canvas.toDataURL('image/png'), d.t, d.u);
      });
      img.src = data;
    })
  }
  sendResponse();
})

function tabUpdateListener(tabId, changeInfo, tab) {
  saveToClipboard(changeInfo.url);
}

function saveToClipboard(str) {
    var textArea = document.createElement('textarea');
    textArea.style.cssText = 'position:absolute;left:-100%';

    document.body.appendChild(textArea);

    textArea.value = str;
    textArea.select();
    document.execCommand('copy');

    document.body.removeChild(textArea);
}
