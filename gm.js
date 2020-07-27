
function GM_registerMenuCommand(name, fn) {
    var menuId = '#' + name;
    var onUnload = function() {
        if (V) console.log("env: unRegisterMenuCMD due to unload " + fn.toString());
    };
    var resp = function(response) {
        // response is send, command is unregisterd @ background page
        window.removeEventListener('unload', onUnload, false);
        if (response.run) {
            if (V) console.log("env: execMenuCmd " + fn.toString());
            window.setTimeout(function () { fn(); }, 1);
            // re-register for next click
            GM_registerMenuCommand(name, fn);
        }
    };
    window.addEventListener('unload', onUnload, false);
    if (V) console.log("env: registerMenuCmd " + fn.toString());
};

function GM_openInTab(url) {
    window.open(url, "");
}

function GM_log(message) {
  window.console.log(message);
}

function GM_xmlhttpRequest(details) {
    function setupEvent(xhr, url, eventName, callback) {
      xhr[eventName] = function () {
        var isComplete = xhr.readyState == 4;
        var responseState = {
          responseText: xhr.responseText,
          readyState: xhr.readyState,
          responseHeaders: isComplete ? xhr.getAllResponseHeaders() : "",
          status: isComplete ? xhr.status : 0,
          statusText: isComplete ? xhr.statusText : "",
          finalUrl: isComplete ? url : ""
        };
        callback(responseState);
      };
    }
  
    var xhr = new XMLHttpRequest();
    var eventNames = ["onload", "onerror", "onreadystatechange"];
    for (var i = 0; i < eventNames.length; i++ ) {
      var eventName = eventNames[i];
      if (eventName in details) {
        setupEvent(xhr, details.url, eventName, details[eventName]);
      }
    }
  
    xhr.open(details.method, details.url);
  
    if (details.overrideMimeType) {
      xhr.overrideMimeType(details.overrideMimeType);
    }
    if (details.headers) {
      for (var header in details.headers) {
        xhr.setRequestHeader(header, details.headers[header]);
      }
    }
    xhr.send(details.data ? details.data : null);
}

function GM_addStyle(css) {
    var parent = document.getElementsByTagName("head")[0];
    if (!parent) {
      parent = document.documentElement;
    }
    var style = document.createElement("style");
    style.type = "text/css";
    var textNode = document.createTextNode(css);
    style.appendChild(textNode);
    parent.appendChild(style);
}