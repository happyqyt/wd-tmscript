// ==UserScript==
// @name          DownAlbum
// @author        indream
// @version       0.20.4.2
// @description   Download Facebook (Album & Video), Instagram, Pinterest, Twitter, Ask.fm, Weibo Album.
// @namespace     DownAlbum
// @grant         unsafeWindow
// @grant         GM_xmlhttpRequest
// @include       htt*://*.facebook.com/*
// @include       htt*://*.facebook.com/*/*
// @include       htt*://instagram.com/*
// @include       htt*://*.instagram.com/*
// @include       htt*://twitter.com/*
// @include       htt*://*.weibo.com/*
// @include       htt*://weibo.com/*
// @include       htt*://www.pinterest.com/*
// @include       htt*://www.pinterest.*/*
// @include       htt*://ask.fm/*
// @exclude       htt*://*static*.facebook.com*
// @exclude       htt*://*channel*.facebook.com*
// @exclude       htt*://developers.facebook.com/*
// @exclude       htt*://upload.facebook.com/*
// @exclude       htt*://*onnect.facebook.com/*
// @exclude       htt*://*acebook.com/connect*
// @exclude       htt*://*.facebook.com/plugins/*
// @exclude       htt*://*.facebook.com/l.php*
// @exclude       htt*://*.facebook.com/ai.php*
// @exclude       htt*://*.facebook.com/extern/*
// @exclude       htt*://*.facebook.com/pagelet/*
// @exclude       htt*://api.facebook.com/static/*
// @exclude       htt*://*.facebook.com/contact_importer/*
// @exclude       htt*://*.facebook.com/ajax/*
// @exclude       htt*://www.facebook.com/places/map*_iframe.php*
// @exclude       https://www.facebook.com/xti.php
// @exclude       https://*.ak.facebook.com/*
// @exclude       https://www.facebook.com/ajax/pagelet/generic.php/*
// @exclude       https://www.facebook.com/*/plugins/*
// @exclude       https://www.facebook.com/xti.php*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require       https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.10.0/js/md5.min.js
// ==/UserScript==


/*======================================================================*/
// dependens
    function _(str, ...args) {
      return [str, args].flat().join(' ');
    }
    function _randomUuid() {
      const randomInts = new Uint8Array(16);
      window.crypto.getRandomValues(randomInts);
      const randomChars = [];
      for (let i = 0; i<16; i++) {
        let s = randomInts[i].toString(16).padStart(2, '0');
        randomChars.push(s.substr(0, 1));
        randomChars.push(s.substr(1, 1));
      }

      let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
      uuid = uuid.replace(/[xy]/g, function(c) {
        let r = randomChars.shift();
        if (c == 'y') {
          r = (parseInt(r, 16)&0x3|0x8).toString(16);
        }
        return r;
      });

      return uuid;
    }
    var _uuid = _randomUuid()

    function objectPick(obj, keys, transform) {
      return keys.reduce((res, key) => {
        let value = obj?obj[key]:null;
        if (transform) value = transform(value);
        if (value != null) res[key] = value;
        return res;
      }, {});
    }
    var NS_HTML = 'http://www.w3.org/1999/xhtml';
    function downloadBlob(res) {
      let { context: { name, onload }, response } = res;
      let url = URL.createObjectURL(response);
      let a = document.createElementNS(NS_HTML, 'a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      if (name) a.setAttribute('download', name);
      document.documentElement.append(a);
      a.click();
      setTimeout(() => {
        a.remove(a);
        URL.revokeObjectURL(url);
        onload?onload(res):undefined;
      }, 3000);
    }

    // onRequestCreate lib
    var handlers = {};
    var callbacks = {};
    var bridge = {
      callbacks,
      load: () => {},
      addHandlers(obj) {
        Object.assign(handlers, obj);
      },
      onHandle({ cmd, data }) {
        handlers[cmd]?handlers[cmd](data):undefined;
      },
      send(cmd, data) {
        return new Promise(resolve => {
          postWithCallback(cmd, data, resolve);
        });
      },
      sendSync(cmd, data) {
        let res;
        postWithCallback(cmd, data, payload => { res = payload; });
        return res;
      },
    };
    var contentId = getUniqId();
    var webId = getUniqId();
    bridge.post = bindEvents(webId, contentId, bridge.onHandle);
    function bindEvents(srcId, destId, handle, cloneInto) {
      document.addEventListener(srcId, e => handle(e.detail));
      const pageContext = cloneInto && document.defaultView;
      return (cmd, params) => {
        const data = { cmd, data: params };
        const detail = cloneInto ? cloneInto(data, pageContext) : data;
        const e = new CustomEvent(destId, { detail });
        document.dispatchEvent(e);
      };
    }
    function postWithCallback(cmd, data, cb) {
      const id = getUniqId();
      callbacks[id] = (payload) => {
        delete callbacks[id];
        cb(payload);
      };
      bridge.post(cmd, { callbackId: id, payload: data });
    }
    function getUniqId(prefix = 'VM') {
      var getNow = performance ? performance.now.bind(performance) : Date.now;
      const now = getNow()
      return prefix
        + Math.floor((now - Math.floor(now)) * 1e12).toString(36)
        + Math.floor(Math.random() * 1e12).toString(36);
    }
    function onRequestCreate(details, scriptId) {
      if (!details.url) throw new Error('Required parameter "url" is missing.');
      const req = {
        scriptId,
        details,
        req: {
          abort() {
            bridge.post('AbortRequest', req.scriptId);
          },
        },
      };
      details.url = getFullUrl(details.url);
      bridge.send('GetRequestId', {
        eventsToNotify: [
          'abort',
          'error',
          'load',
          'loadend',
          'loadstart',
          'progress',
          'readystatechange',
          'timeout',
        ].filter(e => typeof details[`on${e}`] === 'function'),
        wantsBlob: details.responseType === 'blob',
      })
      .then(id => start(req, id));
      return req.req;
    }
    function getFullUrl(url) {
      const a = document.createElementNS(NS_HTML, 'a');
      a.setAttribute('href', url);
      return a.href;
    }
    async function start(req, id) {
      const { details, scriptId } = req;
      // withCredentials is for GM4 compatibility and used only if `anonymous` is not set,
      // it's true by default per the standard/historical behavior of gmxhr
      const { withCredentials = true, anonymous = !withCredentials } = details;
      const payload = Object.assign({
        id,
        scriptId,
        anonymous,
      }, objectPick(details, [
        'headers',
        'method',
        'overrideMimeType',
        'password',
        'timeout',
        'url',
        'user',
      ]));
      req.id = id;
      idMap[id] = req;
      const { responseType } = details;
      if (responseType) {
        if (['arraybuffer', 'blob'].includes(responseType)) {
          payload.chunkType = 'blob';
        } else if (!['document', 'json', 'text'].includes(responseType)) {
          log('warn', null, `Unknown responseType "${responseType}", see https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest for more detail.`);
        }
      }
      // TM/GM-compatibility: the `binary` option works only with a string `data`
      payload.data = details.binary
        ? { value: `${details.data}`, cls: 'blob' }
        : await encodeBody(details.data);
      bridge.post('HttpRequest', payload);
    }
    var idMap = {};
    var logging = Object.assign({}, console);
    function log(level, tags, ...args) {
      const tagList = ['Violentmonkey'];
      if (tags) tagList.push(...tags);
      const prefix = tagList.map(tag => `[${tag}]`).join('');
      logging[level](prefix, ...args);
    }
    async function encodeBody(body) {
      const cls = getType(body);
      switch (cls) {
      case 'formdata': {
        const data = {};
        const resolveKeyValues = async (key) => {
          const values = body.getAll(key).map(encodeBody);
          data[key] = await Promise.all(values);
        };
        await Promise.all([...body.keys()].map(resolveKeyValues));
        return { cls, value: data };
      }
      case 'blob':
      case 'file':
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            cls,
            value: buffer2stringSafe(reader.result),
            type: body.type,
            name: body.name,
            lastModified: body.lastModified,
          });
          reader.readAsArrayBuffer(body);
        });
      default:
        if (body) return { cls, value: jsonDump(body) };
      }
    }
    function getType(obj) {
      const type = typeof obj;
      if (type !== 'object') return type;
      const typeString = obj.toString(); // [object TYPENAME]
      return typeString.slice(8, -1).toLowerCase();
    }
    function buffer2stringSafe(buf) {
      const size = buf.byteLength;
      // The max number of arguments varies between JS engines but it's >32k so 10k is safe
      const stepSize = 10e3;
      const stringChunks = [];
      for (let from = 0; from < size; from += stepSize) {
        const sourceChunk = new Uint8Array(buf, from, Math.min(stepSize, size - from));
        stringChunks.push(String.fromCharCode(...sourceChunk));
      }
      return stringChunks.join('');
    }
    var escMap = {
      '"': '\\"',
      '\\': '\\\\',
      '\b': '\\b',
      '\f': '\\f',
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t',
    };
    var escRE = /[\\"\u0000-\u001F\u2028\u2029]/g; // eslint-disable-line no-control-regex
    var escFunc = m => escMap[m] || `\\u${(m.charCodeAt(0) + 0x10000).toString(16).slice(1)}`;
    function jsonDump(value) {
      if (value == null) return 'null';
      const type = typeof value;
      if (type === 'number') return isFinite(value) ? `${value}` : 'null';
      if (type === 'boolean') return `${value}`;
      if (type === 'object') {
        if (isArray(value)) {
          return `[${value.map(jsonDump).join(',')}]`;
        }
        if (value.objectToString() === '[object Object]') {
          const res = Object.keys(value).map((key) => {
            const v = value[key];
            return v !== undefined && `${jsonDump(key)}:${jsonDump(v)}`;
          });
          // JSON.stringify skips undefined in objects i.e. {foo: undefined} produces {}
          return `{${res.filter(Boolean).join(',')}}`;
        }
      }
      return `"${value.replace(escRE, escFunc)}"`;
    }
// end of dependens

// api resources
    function apiOpenInTab(message) {
      var openerTab
      chrome.tabs.getCurrent(tab => {
        openerTab = tab
      })
      const tab = {
        url: message.url,
        active: message.active,
      };
      chrome.runtime.getBrowserInfo(browserInfo => {
        if (browserInfo.name === 'Firefox' && browserInfo.version.split('.')[0] < 57) {
          tab.windowId = openerTab.windowId;
          tab.index = openerTab.index + 1; // next to senderTab
        } else {
          tab.openerTabId = openerTab.id;
        }

        chrome.tabs.create(tab);
      });
    }
    function apiGetResourceBlob(message, sendResponse) {
      if (!message.uuid) {
        console.error('onApiGetResourceBlob handler got no UUID.');
        sendResponse(false);
        return;
      } else if (!message.resourceName) {
        console.error('onApiGetResourceBlob handler got no resourceName.');
        sendResponse(false);
        return;
      } else if (!userScripts[message.uuid]) {
        console.error(
            'onApiGetResourceBlob handler got non-installed UUID:', message.uuid);
        sendResponse(false);
        return;
      }
      // checkApiCallAllowed('GM.getResourceUrl', message.uuid);

      let userScript = userScripts[message.uuid];
      let resource = userScript.resources[message.resourceName];
      if (!resource) {
        sendResponse(false);
      } else {
        sendResponse({
          'blob': resource.blob,
          'mimetype': resource.mimetype,
          'resourceName': message.resourceName,
        });
      }
    }
    function apiSetValue(message, sendResponse) {
      if (!message.uuid) {
        console.warn('ApiSetValue handler got no UUID.');
        return;
      } else if (!message.key) {
        console.warn('ApiSetValue handler got no key.');
        return;
      }
      // checkApiCallAllowed('GM.setValue', message.uuid);

      // Return a promise
      return setValue(message.uuid, message.key, message.value);
    }
    async function setValue(uuid, key, value) {
      let scriptDb = await scriptStoreDb(uuid);
      let txn = scriptDb.transaction([valueStoreName], 'readwrite');
      let store = txn.objectStore(valueStoreName);
      let req = store.put({'value': value}, key);
      scriptDb.close();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          resolve(true);
        };
        req.onerror = event => {
          console.warn('failed to set', key, 'for', uuid, ':', event);
          // Don't reject to maintain compatibility with code that expects a
          // false return value.
          resolve(false);
        };
      });
    }
    const valueStoreName = 'values';
    function scriptStoreDb(uuid) {
      function openDb() {
        const dbVersion = 1;
        return new Promise((resolve, reject) => {
          let dbOpen = indexedDB.open('user-script-' + uuid, dbVersion);
          dbOpen.onerror = event => {
            console.error('Error opening script store DB!', uuid, event);
            reject(event);
          };
          dbOpen.onsuccess = event => {
            resolve(event.target.result);
          };
          dbOpen.onupgradeneeded = event => {
            let db = event.target.result;
            db.onerror = event => {
              console.error('Error upgrading script store DB!', uuid, event);
              reject(event);
            };
            db.createObjectStore(valueStoreName, {'keypath': 'key'});
          };
        });
      }

      // Android does not support persist. Conditionally set it.
      if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persist().then(openDb);
      } else {
        return openDb();
      }
    }
    function apiGetValue(message, sendResponse) {
      if (!message.uuid) {
        console.warn('ApiGetValue handler got no UUID.');
        return;
      } else if (!message.key) {
        console.warn('ApiGetValue handler got no key.');
        return;
      }

      // Return a promise
      return getValue(message.uuid, message.key);
    }
    async function getValue(uuid, key) {
      let scriptDb = await scriptStoreDb(uuid);
      let txn = scriptDb.transaction([valueStoreName], 'readonly');
      let store = txn.objectStore(valueStoreName);
      let req = store.get(key);
      scriptDb.close();

      return new Promise(resolve => {
        req.onsuccess = event => {
          if (!event.target.result) {
            resolve(undefined);
          } else {
            resolve(req.result.value);
          }
        };
        req.onerror = event => {
          console.warn('failed to retrieve', key, 'for', uuid, ':', event);
          // Don't reject to maintain compatibility with code that expects a
          // undefined return value.
          resolve(undefined);
        };
      });
    }
// end of api resources

// begin grant apis
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
	function GM_log(message) {
	  window.console.log(message);
	}
// end of grant apis


/*! jQuery v3.3.1 | (c) JS Foundation and other contributors | jquery.org/license */
!function(e,t){"use strict";"object"==typeof module&&"object"==typeof module.exports?module.exports=e.document?t(e,!0):function(e){if(!e.document)throw new Error("jQuery requires a window with a document");return t(e)}:t(e)}("undefined"!=typeof window?window:this,function(e,t){"use strict";var n=[],r=e.document,i=Object.getPrototypeOf,o=n.slice,a=n.concat,s=n.push,u=n.indexOf,l={},c=l.toString,f=l.hasOwnProperty,p=f.toString,d=p.call(Object),h={},g=function e(t){return"function"==typeof t&&"number"!=typeof t.nodeType},y=function e(t){return null!=t&&t===t.window},v={type:!0,src:!0,noModule:!0};function m(e,t,n){var i,o=(t=t||r).createElement("script");if(o.text=e,n)for(i in v)n[i]&&(o[i]=n[i]);t.head.appendChild(o).parentNode.removeChild(o)}function x(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?l[c.call(e)]||"object":typeof e}var b="3.3.1",w=function(e,t){return new w.fn.init(e,t)},T=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;w.fn=w.prototype={jquery:"3.3.1",constructor:w,length:0,toArray:function(){return o.call(this)},get:function(e){return null==e?o.call(this):e<0?this[e+this.length]:this[e]},pushStack:function(e){var t=w.merge(this.constructor(),e);return t.prevObject=this,t},each:function(e){return w.each(this,e)},map:function(e){return this.pushStack(w.map(this,function(t,n){return e.call(t,n,t)}))},slice:function(){return this.pushStack(o.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(e<0?t:0);return this.pushStack(n>=0&&n<t?[this[n]]:[])},end:function(){return this.prevObject||this.constructor()},push:s,sort:n.sort,splice:n.splice},w.extend=w.fn.extend=function(){var e,t,n,r,i,o,a=arguments[0]||{},s=1,u=arguments.length,l=!1;for("boolean"==typeof a&&(l=a,a=arguments[s]||{},s++),"object"==typeof a||g(a)||(a={}),s===u&&(a=this,s--);s<u;s++)if(null!=(e=arguments[s]))for(t in e)n=a[t],a!==(r=e[t])&&(l&&r&&(w.isPlainObject(r)||(i=Array.isArray(r)))?(i?(i=!1,o=n&&Array.isArray(n)?n:[]):o=n&&w.isPlainObject(n)?n:{},a[t]=w.extend(l,o,r)):void 0!==r&&(a[t]=r));return a},w.extend({expando:"jQuery"+("3.3.1"+Math.random()).replace(/\D/g,""),isReady:!0,error:function(e){throw new Error(e)},noop:function(){},isPlainObject:function(e){var t,n;return!(!e||"[object Object]"!==c.call(e))&&(!(t=i(e))||"function"==typeof(n=f.call(t,"constructor")&&t.constructor)&&p.call(n)===d)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},globalEval:function(e){m(e)},each:function(e,t){var n,r=0;if(C(e)){for(n=e.length;r<n;r++)if(!1===t.call(e[r],r,e[r]))break}else for(r in e)if(!1===t.call(e[r],r,e[r]))break;return e},trim:function(e){return null==e?"":(e+"").replace(T,"")},makeArray:function(e,t){var n=t||[];return null!=e&&(C(Object(e))?w.merge(n,"string"==typeof e?[e]:e):s.call(n,e)),n},inArray:function(e,t,n){return null==t?-1:u.call(t,e,n)},merge:function(e,t){for(var n=+t.length,r=0,i=e.length;r<n;r++)e[i++]=t[r];return e.length=i,e},grep:function(e,t,n){for(var r,i=[],o=0,a=e.length,s=!n;o<a;o++)(r=!t(e[o],o))!==s&&i.push(e[o]);return i},map:function(e,t,n){var r,i,o=0,s=[];if(C(e))for(r=e.length;o<r;o++)null!=(i=t(e[o],o,n))&&s.push(i);else for(o in e)null!=(i=t(e[o],o,n))&&s.push(i);return a.apply([],s)},guid:1,support:h}),"function"==typeof Symbol&&(w.fn[Symbol.iterator]=n[Symbol.iterator]),w.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "),function(e,t){l["[object "+t+"]"]=t.toLowerCase()});function C(e){var t=!!e&&"length"in e&&e.length,n=x(e);return!g(e)&&!y(e)&&("array"===n||0===t||"number"==typeof t&&t>0&&t-1 in e)}var E=function(e){var t,n,r,i,o,a,s,u,l,c,f,p,d,h,g,y,v,m,x,b="sizzle"+1*new Date,w=e.document,T=0,C=0,E=ae(),k=ae(),S=ae(),D=function(e,t){return e===t&&(f=!0),0},N={}.hasOwnProperty,A=[],j=A.pop,q=A.push,L=A.push,H=A.slice,O=function(e,t){for(var n=0,r=e.length;n<r;n++)if(e[n]===t)return n;return-1},P="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",M="[\\x20\\t\\r\\n\\f]",R="(?:\\\\.|[\\w-]|[^\0-\\xa0])+",I="\\["+M+"*("+R+")(?:"+M+"*([*^$|!~]?=)"+M+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+R+"))|)"+M+"*\\]",W=":("+R+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+I+")*)|.*)\\)|)",$=new RegExp(M+"+","g"),B=new RegExp("^"+M+"+|((?:^|[^\\\\])(?:\\\\.)*)"+M+"+$","g"),F=new RegExp("^"+M+"*,"+M+"*"),_=new RegExp("^"+M+"*([>+~]|"+M+")"+M+"*"),z=new RegExp("="+M+"*([^\\]'\"]*?)"+M+"*\\]","g"),X=new RegExp(W),U=new RegExp("^"+R+"$"),V={ID:new RegExp("^#("+R+")"),CLASS:new RegExp("^\\.("+R+")"),TAG:new RegExp("^("+R+"|[*])"),ATTR:new RegExp("^"+I),PSEUDO:new RegExp("^"+W),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+M+"*(even|odd|(([+-]|)(\\d*)n|)"+M+"*(?:([+-]|)"+M+"*(\\d+)|))"+M+"*\\)|)","i"),bool:new RegExp("^(?:"+P+")$","i"),needsContext:new RegExp("^"+M+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+M+"*((?:-\\d)?\\d*)"+M+"*\\)|)(?=[^-]|$)","i")},G=/^(?:input|select|textarea|button)$/i,Y=/^h\d$/i,Q=/^[^{]+\{\s*\[native \w/,J=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,K=/[+~]/,Z=new RegExp("\\\\([\\da-f]{1,6}"+M+"?|("+M+")|.)","ig"),ee=function(e,t,n){var r="0x"+t-65536;return r!==r||n?t:r<0?String.fromCharCode(r+65536):String.fromCharCode(r>>10|55296,1023&r|56320)},te=/([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,ne=function(e,t){return t?"\0"===e?"\ufffd":e.slice(0,-1)+"\\"+e.charCodeAt(e.length-1).toString(16)+" ":"\\"+e},re=function(){p()},ie=me(function(e){return!0===e.disabled&&("form"in e||"label"in e)},{dir:"parentNode",next:"legend"});try{L.apply(A=H.call(w.childNodes),w.childNodes),A[w.childNodes.length].nodeType}catch(e){L={apply:A.length?function(e,t){q.apply(e,H.call(t))}:function(e,t){var n=e.length,r=0;while(e[n++]=t[r++]);e.length=n-1}}}function oe(e,t,r,i){var o,s,l,c,f,h,v,m=t&&t.ownerDocument,T=t?t.nodeType:9;if(r=r||[],"string"!=typeof e||!e||1!==T&&9!==T&&11!==T)return r;if(!i&&((t?t.ownerDocument||t:w)!==d&&p(t),t=t||d,g)){if(11!==T&&(f=J.exec(e)))if(o=f[1]){if(9===T){if(!(l=t.getElementById(o)))return r;if(l.id===o)return r.push(l),r}else if(m&&(l=m.getElementById(o))&&x(t,l)&&l.id===o)return r.push(l),r}else{if(f[2])return L.apply(r,t.getElementsByTagName(e)),r;if((o=f[3])&&n.getElementsByClassName&&t.getElementsByClassName)return L.apply(r,t.getElementsByClassName(o)),r}if(n.qsa&&!S[e+" "]&&(!y||!y.test(e))){if(1!==T)m=t,v=e;else if("object"!==t.nodeName.toLowerCase()){(c=t.getAttribute("id"))?c=c.replace(te,ne):t.setAttribute("id",c=b),s=(h=a(e)).length;while(s--)h[s]="#"+c+" "+ve(h[s]);v=h.join(","),m=K.test(e)&&ge(t.parentNode)||t}if(v)try{return L.apply(r,m.querySelectorAll(v)),r}catch(e){}finally{c===b&&t.removeAttribute("id")}}}return u(e.replace(B,"$1"),t,r,i)}function ae(){var e=[];function t(n,i){return e.push(n+" ")>r.cacheLength&&delete t[e.shift()],t[n+" "]=i}return t}function se(e){return e[b]=!0,e}function ue(e){var t=d.createElement("fieldset");try{return!!e(t)}catch(e){return!1}finally{t.parentNode&&t.parentNode.removeChild(t),t=null}}function le(e,t){var n=e.split("|"),i=n.length;while(i--)r.attrHandle[n[i]]=t}function ce(e,t){var n=t&&e,r=n&&1===e.nodeType&&1===t.nodeType&&e.sourceIndex-t.sourceIndex;if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function fe(e){return function(t){return"input"===t.nodeName.toLowerCase()&&t.type===e}}function pe(e){return function(t){var n=t.nodeName.toLowerCase();return("input"===n||"button"===n)&&t.type===e}}function de(e){return function(t){return"form"in t?t.parentNode&&!1===t.disabled?"label"in t?"label"in t.parentNode?t.parentNode.disabled===e:t.disabled===e:t.isDisabled===e||t.isDisabled!==!e&&ie(t)===e:t.disabled===e:"label"in t&&t.disabled===e}}function he(e){return se(function(t){return t=+t,se(function(n,r){var i,o=e([],n.length,t),a=o.length;while(a--)n[i=o[a]]&&(n[i]=!(r[i]=n[i]))})})}function ge(e){return e&&"undefined"!=typeof e.getElementsByTagName&&e}n=oe.support={},o=oe.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return!!t&&"HTML"!==t.nodeName},p=oe.setDocument=function(e){var t,i,a=e?e.ownerDocument||e:w;return a!==d&&9===a.nodeType&&a.documentElement?(d=a,h=d.documentElement,g=!o(d),w!==d&&(i=d.defaultView)&&i.top!==i&&(i.addEventListener?i.addEventListener("unload",re,!1):i.attachEvent&&i.attachEvent("onunload",re)),n.attributes=ue(function(e){return e.className="i",!e.getAttribute("className")}),n.getElementsByTagName=ue(function(e){return e.appendChild(d.createComment("")),!e.getElementsByTagName("*").length}),n.getElementsByClassName=Q.test(d.getElementsByClassName),n.getById=ue(function(e){return h.appendChild(e).id=b,!d.getElementsByName||!d.getElementsByName(b).length}),n.getById?(r.filter.ID=function(e){var t=e.replace(Z,ee);return function(e){return e.getAttribute("id")===t}},r.find.ID=function(e,t){if("undefined"!=typeof t.getElementById&&g){var n=t.getElementById(e);return n?[n]:[]}}):(r.filter.ID=function(e){var t=e.replace(Z,ee);return function(e){var n="undefined"!=typeof e.getAttributeNode&&e.getAttributeNode("id");return n&&n.value===t}},r.find.ID=function(e,t){if("undefined"!=typeof t.getElementById&&g){var n,r,i,o=t.getElementById(e);if(o){if((n=o.getAttributeNode("id"))&&n.value===e)return[o];i=t.getElementsByName(e),r=0;while(o=i[r++])if((n=o.getAttributeNode("id"))&&n.value===e)return[o]}return[]}}),r.find.TAG=n.getElementsByTagName?function(e,t){return"undefined"!=typeof t.getElementsByTagName?t.getElementsByTagName(e):n.qsa?t.querySelectorAll(e):void 0}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},r.find.CLASS=n.getElementsByClassName&&function(e,t){if("undefined"!=typeof t.getElementsByClassName&&g)return t.getElementsByClassName(e)},v=[],y=[],(n.qsa=Q.test(d.querySelectorAll))&&(ue(function(e){h.appendChild(e).innerHTML="<a id='"+b+"'></a><select id='"+b+"-\r\\' msallowcapture=''><option selected=''></option></select>",e.querySelectorAll("[msallowcapture^='']").length&&y.push("[*^$]="+M+"*(?:''|\"\")"),e.querySelectorAll("[selected]").length||y.push("\\["+M+"*(?:value|"+P+")"),e.querySelectorAll("[id~="+b+"-]").length||y.push("~="),e.querySelectorAll(":checked").length||y.push(":checked"),e.querySelectorAll("a#"+b+"+*").length||y.push(".#.+[+~]")}),ue(function(e){e.innerHTML="<a href='' disabled='disabled'></a><select disabled='disabled'><option/></select>";var t=d.createElement("input");t.setAttribute("type","hidden"),e.appendChild(t).setAttribute("name","D"),e.querySelectorAll("[name=d]").length&&y.push("name"+M+"*[*^$|!~]?="),2!==e.querySelectorAll(":enabled").length&&y.push(":enabled",":disabled"),h.appendChild(e).disabled=!0,2!==e.querySelectorAll(":disabled").length&&y.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),y.push(",.*:")})),(n.matchesSelector=Q.test(m=h.matches||h.webkitMatchesSelector||h.mozMatchesSelector||h.oMatchesSelector||h.msMatchesSelector))&&ue(function(e){n.disconnectedMatch=m.call(e,"*"),m.call(e,"[s!='']:x"),v.push("!=",W)}),y=y.length&&new RegExp(y.join("|")),v=v.length&&new RegExp(v.join("|")),t=Q.test(h.compareDocumentPosition),x=t||Q.test(h.contains)?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},D=t?function(e,t){if(e===t)return f=!0,0;var r=!e.compareDocumentPosition-!t.compareDocumentPosition;return r||(1&(r=(e.ownerDocument||e)===(t.ownerDocument||t)?e.compareDocumentPosition(t):1)||!n.sortDetached&&t.compareDocumentPosition(e)===r?e===d||e.ownerDocument===w&&x(w,e)?-1:t===d||t.ownerDocument===w&&x(w,t)?1:c?O(c,e)-O(c,t):0:4&r?-1:1)}:function(e,t){if(e===t)return f=!0,0;var n,r=0,i=e.parentNode,o=t.parentNode,a=[e],s=[t];if(!i||!o)return e===d?-1:t===d?1:i?-1:o?1:c?O(c,e)-O(c,t):0;if(i===o)return ce(e,t);n=e;while(n=n.parentNode)a.unshift(n);n=t;while(n=n.parentNode)s.unshift(n);while(a[r]===s[r])r++;return r?ce(a[r],s[r]):a[r]===w?-1:s[r]===w?1:0},d):d},oe.matches=function(e,t){return oe(e,null,null,t)},oe.matchesSelector=function(e,t){if((e.ownerDocument||e)!==d&&p(e),t=t.replace(z,"='$1']"),n.matchesSelector&&g&&!S[t+" "]&&(!v||!v.test(t))&&(!y||!y.test(t)))try{var r=m.call(e,t);if(r||n.disconnectedMatch||e.document&&11!==e.document.nodeType)return r}catch(e){}return oe(t,d,null,[e]).length>0},oe.contains=function(e,t){return(e.ownerDocument||e)!==d&&p(e),x(e,t)},oe.attr=function(e,t){(e.ownerDocument||e)!==d&&p(e);var i=r.attrHandle[t.toLowerCase()],o=i&&N.call(r.attrHandle,t.toLowerCase())?i(e,t,!g):void 0;return void 0!==o?o:n.attributes||!g?e.getAttribute(t):(o=e.getAttributeNode(t))&&o.specified?o.value:null},oe.escape=function(e){return(e+"").replace(te,ne)},oe.error=function(e){throw new Error("Syntax error, unrecognized expression: "+e)},oe.uniqueSort=function(e){var t,r=[],i=0,o=0;if(f=!n.detectDuplicates,c=!n.sortStable&&e.slice(0),e.sort(D),f){while(t=e[o++])t===e[o]&&(i=r.push(o));while(i--)e.splice(r[i],1)}return c=null,e},i=oe.getText=function(e){var t,n="",r=0,o=e.nodeType;if(o){if(1===o||9===o||11===o){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=i(e)}else if(3===o||4===o)return e.nodeValue}else while(t=e[r++])n+=i(t);return n},(r=oe.selectors={cacheLength:50,createPseudo:se,match:V,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(Z,ee),e[3]=(e[3]||e[4]||e[5]||"").replace(Z,ee),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||oe.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&oe.error(e[0]),e},PSEUDO:function(e){var t,n=!e[6]&&e[2];return V.CHILD.test(e[0])?null:(e[3]?e[2]=e[4]||e[5]||"":n&&X.test(n)&&(t=a(n,!0))&&(t=n.indexOf(")",n.length-t)-n.length)&&(e[0]=e[0].slice(0,t),e[2]=n.slice(0,t)),e.slice(0,3))}},filter:{TAG:function(e){var t=e.replace(Z,ee).toLowerCase();return"*"===e?function(){return!0}:function(e){return e.nodeName&&e.nodeName.toLowerCase()===t}},CLASS:function(e){var t=E[e+" "];return t||(t=new RegExp("(^|"+M+")"+e+"("+M+"|$)"))&&E(e,function(e){return t.test("string"==typeof e.className&&e.className||"undefined"!=typeof e.getAttribute&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=oe.attr(r,e);return null==i?"!="===t:!t||(i+="","="===t?i===n:"!="===t?i!==n:"^="===t?n&&0===i.indexOf(n):"*="===t?n&&i.indexOf(n)>-1:"$="===t?n&&i.slice(-n.length)===n:"~="===t?(" "+i.replace($," ")+" ").indexOf(n)>-1:"|="===t&&(i===n||i.slice(0,n.length+1)===n+"-"))}},CHILD:function(e,t,n,r,i){var o="nth"!==e.slice(0,3),a="last"!==e.slice(-4),s="of-type"===t;return 1===r&&0===i?function(e){return!!e.parentNode}:function(t,n,u){var l,c,f,p,d,h,g=o!==a?"nextSibling":"previousSibling",y=t.parentNode,v=s&&t.nodeName.toLowerCase(),m=!u&&!s,x=!1;if(y){if(o){while(g){p=t;while(p=p[g])if(s?p.nodeName.toLowerCase()===v:1===p.nodeType)return!1;h=g="only"===e&&!h&&"nextSibling"}return!0}if(h=[a?y.firstChild:y.lastChild],a&&m){x=(d=(l=(c=(f=(p=y)[b]||(p[b]={}))[p.uniqueID]||(f[p.uniqueID]={}))[e]||[])[0]===T&&l[1])&&l[2],p=d&&y.childNodes[d];while(p=++d&&p&&p[g]||(x=d=0)||h.pop())if(1===p.nodeType&&++x&&p===t){c[e]=[T,d,x];break}}else if(m&&(x=d=(l=(c=(f=(p=t)[b]||(p[b]={}))[p.uniqueID]||(f[p.uniqueID]={}))[e]||[])[0]===T&&l[1]),!1===x)while(p=++d&&p&&p[g]||(x=d=0)||h.pop())if((s?p.nodeName.toLowerCase()===v:1===p.nodeType)&&++x&&(m&&((c=(f=p[b]||(p[b]={}))[p.uniqueID]||(f[p.uniqueID]={}))[e]=[T,x]),p===t))break;return(x-=i)===r||x%r==0&&x/r>=0}}},PSEUDO:function(e,t){var n,i=r.pseudos[e]||r.setFilters[e.toLowerCase()]||oe.error("unsupported pseudo: "+e);return i[b]?i(t):i.length>1?(n=[e,e,"",t],r.setFilters.hasOwnProperty(e.toLowerCase())?se(function(e,n){var r,o=i(e,t),a=o.length;while(a--)e[r=O(e,o[a])]=!(n[r]=o[a])}):function(e){return i(e,0,n)}):i}},pseudos:{not:se(function(e){var t=[],n=[],r=s(e.replace(B,"$1"));return r[b]?se(function(e,t,n,i){var o,a=r(e,null,i,[]),s=e.length;while(s--)(o=a[s])&&(e[s]=!(t[s]=o))}):function(e,i,o){return t[0]=e,r(t,null,o,n),t[0]=null,!n.pop()}}),has:se(function(e){return function(t){return oe(e,t).length>0}}),contains:se(function(e){return e=e.replace(Z,ee),function(t){return(t.textContent||t.innerText||i(t)).indexOf(e)>-1}}),lang:se(function(e){return U.test(e||"")||oe.error("unsupported lang: "+e),e=e.replace(Z,ee).toLowerCase(),function(t){var n;do{if(n=g?t.lang:t.getAttribute("xml:lang")||t.getAttribute("lang"))return(n=n.toLowerCase())===e||0===n.indexOf(e+"-")}while((t=t.parentNode)&&1===t.nodeType);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===h},focus:function(e){return e===d.activeElement&&(!d.hasFocus||d.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:de(!1),disabled:de(!0),checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,!0===e.selected},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeType<6)return!1;return!0},parent:function(e){return!r.pseudos.empty(e)},header:function(e){return Y.test(e.nodeName)},input:function(e){return G.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||"text"===t.toLowerCase())},first:he(function(){return[0]}),last:he(function(e,t){return[t-1]}),eq:he(function(e,t,n){return[n<0?n+t:n]}),even:he(function(e,t){for(var n=0;n<t;n+=2)e.push(n);return e}),odd:he(function(e,t){for(var n=1;n<t;n+=2)e.push(n);return e}),lt:he(function(e,t,n){for(var r=n<0?n+t:n;--r>=0;)e.push(r);return e}),gt:he(function(e,t,n){for(var r=n<0?n+t:n;++r<t;)e.push(r);return e})}}).pseudos.nth=r.pseudos.eq;for(t in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})r.pseudos[t]=fe(t);for(t in{submit:!0,reset:!0})r.pseudos[t]=pe(t);function ye(){}ye.prototype=r.filters=r.pseudos,r.setFilters=new ye,a=oe.tokenize=function(e,t){var n,i,o,a,s,u,l,c=k[e+" "];if(c)return t?0:c.slice(0);s=e,u=[],l=r.preFilter;while(s){n&&!(i=F.exec(s))||(i&&(s=s.slice(i[0].length)||s),u.push(o=[])),n=!1,(i=_.exec(s))&&(n=i.shift(),o.push({value:n,type:i[0].replace(B," ")}),s=s.slice(n.length));for(a in r.filter)!(i=V[a].exec(s))||l[a]&&!(i=l[a](i))||(n=i.shift(),o.push({value:n,type:a,matches:i}),s=s.slice(n.length));if(!n)break}return t?s.length:s?oe.error(e):k(e,u).slice(0)};function ve(e){for(var t=0,n=e.length,r="";t<n;t++)r+=e[t].value;return r}function me(e,t,n){var r=t.dir,i=t.next,o=i||r,a=n&&"parentNode"===o,s=C++;return t.first?function(t,n,i){while(t=t[r])if(1===t.nodeType||a)return e(t,n,i);return!1}:function(t,n,u){var l,c,f,p=[T,s];if(u){while(t=t[r])if((1===t.nodeType||a)&&e(t,n,u))return!0}else while(t=t[r])if(1===t.nodeType||a)if(f=t[b]||(t[b]={}),c=f[t.uniqueID]||(f[t.uniqueID]={}),i&&i===t.nodeName.toLowerCase())t=t[r]||t;else{if((l=c[o])&&l[0]===T&&l[1]===s)return p[2]=l[2];if(c[o]=p,p[2]=e(t,n,u))return!0}return!1}}function xe(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function be(e,t,n){for(var r=0,i=t.length;r<i;r++)oe(e,t[r],n);return n}function we(e,t,n,r,i){for(var o,a=[],s=0,u=e.length,l=null!=t;s<u;s++)(o=e[s])&&(n&&!n(o,r,i)||(a.push(o),l&&t.push(s)));return a}function Te(e,t,n,r,i,o){return r&&!r[b]&&(r=Te(r)),i&&!i[b]&&(i=Te(i,o)),se(function(o,a,s,u){var l,c,f,p=[],d=[],h=a.length,g=o||be(t||"*",s.nodeType?[s]:s,[]),y=!e||!o&&t?g:we(g,p,e,s,u),v=n?i||(o?e:h||r)?[]:a:y;if(n&&n(y,v,s,u),r){l=we(v,d),r(l,[],s,u),c=l.length;while(c--)(f=l[c])&&(v[d[c]]=!(y[d[c]]=f))}if(o){if(i||e){if(i){l=[],c=v.length;while(c--)(f=v[c])&&l.push(y[c]=f);i(null,v=[],l,u)}c=v.length;while(c--)(f=v[c])&&(l=i?O(o,f):p[c])>-1&&(o[l]=!(a[l]=f))}}else v=we(v===a?v.splice(h,v.length):v),i?i(null,a,v,u):L.apply(a,v)})}function Ce(e){for(var t,n,i,o=e.length,a=r.relative[e[0].type],s=a||r.relative[" "],u=a?1:0,c=me(function(e){return e===t},s,!0),f=me(function(e){return O(t,e)>-1},s,!0),p=[function(e,n,r){var i=!a&&(r||n!==l)||((t=n).nodeType?c(e,n,r):f(e,n,r));return t=null,i}];u<o;u++)if(n=r.relative[e[u].type])p=[me(xe(p),n)];else{if((n=r.filter[e[u].type].apply(null,e[u].matches))[b]){for(i=++u;i<o;i++)if(r.relative[e[i].type])break;return Te(u>1&&xe(p),u>1&&ve(e.slice(0,u-1).concat({value:" "===e[u-2].type?"*":""})).replace(B,"$1"),n,u<i&&Ce(e.slice(u,i)),i<o&&Ce(e=e.slice(i)),i<o&&ve(e))}p.push(n)}return xe(p)}function Ee(e,t){var n=t.length>0,i=e.length>0,o=function(o,a,s,u,c){var f,h,y,v=0,m="0",x=o&&[],b=[],w=l,C=o||i&&r.find.TAG("*",c),E=T+=null==w?1:Math.random()||.1,k=C.length;for(c&&(l=a===d||a||c);m!==k&&null!=(f=C[m]);m++){if(i&&f){h=0,a||f.ownerDocument===d||(p(f),s=!g);while(y=e[h++])if(y(f,a||d,s)){u.push(f);break}c&&(T=E)}n&&((f=!y&&f)&&v--,o&&x.push(f))}if(v+=m,n&&m!==v){h=0;while(y=t[h++])y(x,b,a,s);if(o){if(v>0)while(m--)x[m]||b[m]||(b[m]=j.call(u));b=we(b)}L.apply(u,b),c&&!o&&b.length>0&&v+t.length>1&&oe.uniqueSort(u)}return c&&(T=E,l=w),x};return n?se(o):o}return s=oe.compile=function(e,t){var n,r=[],i=[],o=S[e+" "];if(!o){t||(t=a(e)),n=t.length;while(n--)(o=Ce(t[n]))[b]?r.push(o):i.push(o);(o=S(e,Ee(i,r))).selector=e}return o},u=oe.select=function(e,t,n,i){var o,u,l,c,f,p="function"==typeof e&&e,d=!i&&a(e=p.selector||e);if(n=n||[],1===d.length){if((u=d[0]=d[0].slice(0)).length>2&&"ID"===(l=u[0]).type&&9===t.nodeType&&g&&r.relative[u[1].type]){if(!(t=(r.find.ID(l.matches[0].replace(Z,ee),t)||[])[0]))return n;p&&(t=t.parentNode),e=e.slice(u.shift().value.length)}o=V.needsContext.test(e)?0:u.length;while(o--){if(l=u[o],r.relative[c=l.type])break;if((f=r.find[c])&&(i=f(l.matches[0].replace(Z,ee),K.test(u[0].type)&&ge(t.parentNode)||t))){if(u.splice(o,1),!(e=i.length&&ve(u)))return L.apply(n,i),n;break}}}return(p||s(e,d))(i,t,!g,n,!t||K.test(e)&&ge(t.parentNode)||t),n},n.sortStable=b.split("").sort(D).join("")===b,n.detectDuplicates=!!f,p(),n.sortDetached=ue(function(e){return 1&e.compareDocumentPosition(d.createElement("fieldset"))}),ue(function(e){return e.innerHTML="<a href='#'></a>","#"===e.firstChild.getAttribute("href")})||le("type|href|height|width",function(e,t,n){if(!n)return e.getAttribute(t,"type"===t.toLowerCase()?1:2)}),n.attributes&&ue(function(e){return e.innerHTML="<input/>",e.firstChild.setAttribute("value",""),""===e.firstChild.getAttribute("value")})||le("value",function(e,t,n){if(!n&&"input"===e.nodeName.toLowerCase())return e.defaultValue}),ue(function(e){return null==e.getAttribute("disabled")})||le(P,function(e,t,n){var r;if(!n)return!0===e[t]?t.toLowerCase():(r=e.getAttributeNode(t))&&r.specified?r.value:null}),oe}(e);w.find=E,w.expr=E.selectors,w.expr[":"]=w.expr.pseudos,w.uniqueSort=w.unique=E.uniqueSort,w.text=E.getText,w.isXMLDoc=E.isXML,w.contains=E.contains,w.escapeSelector=E.escape;var k=function(e,t,n){var r=[],i=void 0!==n;while((e=e[t])&&9!==e.nodeType)if(1===e.nodeType){if(i&&w(e).is(n))break;r.push(e)}return r},S=function(e,t){for(var n=[];e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n},D=w.expr.match.needsContext;function N(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()}var A=/^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i;function j(e,t,n){return g(t)?w.grep(e,function(e,r){return!!t.call(e,r,e)!==n}):t.nodeType?w.grep(e,function(e){return e===t!==n}):"string"!=typeof t?w.grep(e,function(e){return u.call(t,e)>-1!==n}):w.filter(t,e,n)}w.filter=function(e,t,n){var r=t[0];return n&&(e=":not("+e+")"),1===t.length&&1===r.nodeType?w.find.matchesSelector(r,e)?[r]:[]:w.find.matches(e,w.grep(t,function(e){return 1===e.nodeType}))},w.fn.extend({find:function(e){var t,n,r=this.length,i=this;if("string"!=typeof e)return this.pushStack(w(e).filter(function(){for(t=0;t<r;t++)if(w.contains(i[t],this))return!0}));for(n=this.pushStack([]),t=0;t<r;t++)w.find(e,i[t],n);return r>1?w.uniqueSort(n):n},filter:function(e){return this.pushStack(j(this,e||[],!1))},not:function(e){return this.pushStack(j(this,e||[],!0))},is:function(e){return!!j(this,"string"==typeof e&&D.test(e)?w(e):e||[],!1).length}});var q,L=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/;(w.fn.init=function(e,t,n){var i,o;if(!e)return this;if(n=n||q,"string"==typeof e){if(!(i="<"===e[0]&&">"===e[e.length-1]&&e.length>=3?[null,e,null]:L.exec(e))||!i[1]&&t)return!t||t.jquery?(t||n).find(e):this.constructor(t).find(e);if(i[1]){if(t=t instanceof w?t[0]:t,w.merge(this,w.parseHTML(i[1],t&&t.nodeType?t.ownerDocument||t:r,!0)),A.test(i[1])&&w.isPlainObject(t))for(i in t)g(this[i])?this[i](t[i]):this.attr(i,t[i]);return this}return(o=r.getElementById(i[2]))&&(this[0]=o,this.length=1),this}return e.nodeType?(this[0]=e,this.length=1,this):g(e)?void 0!==n.ready?n.ready(e):e(w):w.makeArray(e,this)}).prototype=w.fn,q=w(r);var H=/^(?:parents|prev(?:Until|All))/,O={children:!0,contents:!0,next:!0,prev:!0};w.fn.extend({has:function(e){var t=w(e,this),n=t.length;return this.filter(function(){for(var e=0;e<n;e++)if(w.contains(this,t[e]))return!0})},closest:function(e,t){var n,r=0,i=this.length,o=[],a="string"!=typeof e&&w(e);if(!D.test(e))for(;r<i;r++)for(n=this[r];n&&n!==t;n=n.parentNode)if(n.nodeType<11&&(a?a.index(n)>-1:1===n.nodeType&&w.find.matchesSelector(n,e))){o.push(n);break}return this.pushStack(o.length>1?w.uniqueSort(o):o)},index:function(e){return e?"string"==typeof e?u.call(w(e),this[0]):u.call(this,e.jquery?e[0]:e):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){return this.pushStack(w.uniqueSort(w.merge(this.get(),w(e,t))))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}});function P(e,t){while((e=e[t])&&1!==e.nodeType);return e}w.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return k(e,"parentNode")},parentsUntil:function(e,t,n){return k(e,"parentNode",n)},next:function(e){return P(e,"nextSibling")},prev:function(e){return P(e,"previousSibling")},nextAll:function(e){return k(e,"nextSibling")},prevAll:function(e){return k(e,"previousSibling")},nextUntil:function(e,t,n){return k(e,"nextSibling",n)},prevUntil:function(e,t,n){return k(e,"previousSibling",n)},siblings:function(e){return S((e.parentNode||{}).firstChild,e)},children:function(e){return S(e.firstChild)},contents:function(e){return N(e,"iframe")?e.contentDocument:(N(e,"template")&&(e=e.content||e),w.merge([],e.childNodes))}},function(e,t){w.fn[e]=function(n,r){var i=w.map(this,t,n);return"Until"!==e.slice(-5)&&(r=n),r&&"string"==typeof r&&(i=w.filter(r,i)),this.length>1&&(O[e]||w.uniqueSort(i),H.test(e)&&i.reverse()),this.pushStack(i)}});var M=/[^\x20\t\r\n\f]+/g;function R(e){var t={};return w.each(e.match(M)||[],function(e,n){t[n]=!0}),t}w.Callbacks=function(e){e="string"==typeof e?R(e):w.extend({},e);var t,n,r,i,o=[],a=[],s=-1,u=function(){for(i=i||e.once,r=t=!0;a.length;s=-1){n=a.shift();while(++s<o.length)!1===o[s].apply(n[0],n[1])&&e.stopOnFalse&&(s=o.length,n=!1)}e.memory||(n=!1),t=!1,i&&(o=n?[]:"")},l={add:function(){return o&&(n&&!t&&(s=o.length-1,a.push(n)),function t(n){w.each(n,function(n,r){g(r)?e.unique&&l.has(r)||o.push(r):r&&r.length&&"string"!==x(r)&&t(r)})}(arguments),n&&!t&&u()),this},remove:function(){return w.each(arguments,function(e,t){var n;while((n=w.inArray(t,o,n))>-1)o.splice(n,1),n<=s&&s--}),this},has:function(e){return e?w.inArray(e,o)>-1:o.length>0},empty:function(){return o&&(o=[]),this},disable:function(){return i=a=[],o=n="",this},disabled:function(){return!o},lock:function(){return i=a=[],n||t||(o=n=""),this},locked:function(){return!!i},fireWith:function(e,n){return i||(n=[e,(n=n||[]).slice?n.slice():n],a.push(n),t||u()),this},fire:function(){return l.fireWith(this,arguments),this},fired:function(){return!!r}};return l};function I(e){return e}function W(e){throw e}function $(e,t,n,r){var i;try{e&&g(i=e.promise)?i.call(e).done(t).fail(n):e&&g(i=e.then)?i.call(e,t,n):t.apply(void 0,[e].slice(r))}catch(e){n.apply(void 0,[e])}}w.extend({Deferred:function(t){var n=[["notify","progress",w.Callbacks("memory"),w.Callbacks("memory"),2],["resolve","done",w.Callbacks("once memory"),w.Callbacks("once memory"),0,"resolved"],["reject","fail",w.Callbacks("once memory"),w.Callbacks("once memory"),1,"rejected"]],r="pending",i={state:function(){return r},always:function(){return o.done(arguments).fail(arguments),this},"catch":function(e){return i.then(null,e)},pipe:function(){var e=arguments;return w.Deferred(function(t){w.each(n,function(n,r){var i=g(e[r[4]])&&e[r[4]];o[r[1]](function(){var e=i&&i.apply(this,arguments);e&&g(e.promise)?e.promise().progress(t.notify).done(t.resolve).fail(t.reject):t[r[0]+"With"](this,i?[e]:arguments)})}),e=null}).promise()},then:function(t,r,i){var o=0;function a(t,n,r,i){return function(){var s=this,u=arguments,l=function(){var e,l;if(!(t<o)){if((e=r.apply(s,u))===n.promise())throw new TypeError("Thenable self-resolution");l=e&&("object"==typeof e||"function"==typeof e)&&e.then,g(l)?i?l.call(e,a(o,n,I,i),a(o,n,W,i)):(o++,l.call(e,a(o,n,I,i),a(o,n,W,i),a(o,n,I,n.notifyWith))):(r!==I&&(s=void 0,u=[e]),(i||n.resolveWith)(s,u))}},c=i?l:function(){try{l()}catch(e){w.Deferred.exceptionHook&&w.Deferred.exceptionHook(e,c.stackTrace),t+1>=o&&(r!==W&&(s=void 0,u=[e]),n.rejectWith(s,u))}};t?c():(w.Deferred.getStackHook&&(c.stackTrace=w.Deferred.getStackHook()),e.setTimeout(c))}}return w.Deferred(function(e){n[0][3].add(a(0,e,g(i)?i:I,e.notifyWith)),n[1][3].add(a(0,e,g(t)?t:I)),n[2][3].add(a(0,e,g(r)?r:W))}).promise()},promise:function(e){return null!=e?w.extend(e,i):i}},o={};return w.each(n,function(e,t){var a=t[2],s=t[5];i[t[1]]=a.add,s&&a.add(function(){r=s},n[3-e][2].disable,n[3-e][3].disable,n[0][2].lock,n[0][3].lock),a.add(t[3].fire),o[t[0]]=function(){return o[t[0]+"With"](this===o?void 0:this,arguments),this},o[t[0]+"With"]=a.fireWith}),i.promise(o),t&&t.call(o,o),o},when:function(e){var t=arguments.length,n=t,r=Array(n),i=o.call(arguments),a=w.Deferred(),s=function(e){return function(n){r[e]=this,i[e]=arguments.length>1?o.call(arguments):n,--t||a.resolveWith(r,i)}};if(t<=1&&($(e,a.done(s(n)).resolve,a.reject,!t),"pending"===a.state()||g(i[n]&&i[n].then)))return a.then();while(n--)$(i[n],s(n),a.reject);return a.promise()}});var B=/^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;w.Deferred.exceptionHook=function(t,n){e.console&&e.console.warn&&t&&B.test(t.name)&&e.console.warn("jQuery.Deferred exception: "+t.message,t.stack,n)},w.readyException=function(t){e.setTimeout(function(){throw t})};var F=w.Deferred();w.fn.ready=function(e){return F.then(e)["catch"](function(e){w.readyException(e)}),this},w.extend({isReady:!1,readyWait:1,ready:function(e){(!0===e?--w.readyWait:w.isReady)||(w.isReady=!0,!0!==e&&--w.readyWait>0||F.resolveWith(r,[w]))}}),w.ready.then=F.then;function _(){r.removeEventListener("DOMContentLoaded",_),e.removeEventListener("load",_),w.ready()}"complete"===r.readyState||"loading"!==r.readyState&&!r.documentElement.doScroll?e.setTimeout(w.ready):(r.addEventListener("DOMContentLoaded",_),e.addEventListener("load",_));var z=function(e,t,n,r,i,o,a){var s=0,u=e.length,l=null==n;if("object"===x(n)){i=!0;for(s in n)z(e,t,s,n[s],!0,o,a)}else if(void 0!==r&&(i=!0,g(r)||(a=!0),l&&(a?(t.call(e,r),t=null):(l=t,t=function(e,t,n){return l.call(w(e),n)})),t))for(;s<u;s++)t(e[s],n,a?r:r.call(e[s],s,t(e[s],n)));return i?e:l?t.call(e):u?t(e[0],n):o},X=/^-ms-/,U=/-([a-z])/g;function V(e,t){return t.toUpperCase()}function G(e){return e.replace(X,"ms-").replace(U,V)}var Y=function(e){return 1===e.nodeType||9===e.nodeType||!+e.nodeType};function Q(){this.expando=w.expando+Q.uid++}Q.uid=1,Q.prototype={cache:function(e){var t=e[this.expando];return t||(t={},Y(e)&&(e.nodeType?e[this.expando]=t:Object.defineProperty(e,this.expando,{value:t,configurable:!0}))),t},set:function(e,t,n){var r,i=this.cache(e);if("string"==typeof t)i[G(t)]=n;else for(r in t)i[G(r)]=t[r];return i},get:function(e,t){return void 0===t?this.cache(e):e[this.expando]&&e[this.expando][G(t)]},access:function(e,t,n){return void 0===t||t&&"string"==typeof t&&void 0===n?this.get(e,t):(this.set(e,t,n),void 0!==n?n:t)},remove:function(e,t){var n,r=e[this.expando];if(void 0!==r){if(void 0!==t){n=(t=Array.isArray(t)?t.map(G):(t=G(t))in r?[t]:t.match(M)||[]).length;while(n--)delete r[t[n]]}(void 0===t||w.isEmptyObject(r))&&(e.nodeType?e[this.expando]=void 0:delete e[this.expando])}},hasData:function(e){var t=e[this.expando];return void 0!==t&&!w.isEmptyObject(t)}};var J=new Q,K=new Q,Z=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,ee=/[A-Z]/g;function te(e){return"true"===e||"false"!==e&&("null"===e?null:e===+e+""?+e:Z.test(e)?JSON.parse(e):e)}function ne(e,t,n){var r;if(void 0===n&&1===e.nodeType)if(r="data-"+t.replace(ee,"-$&").toLowerCase(),"string"==typeof(n=e.getAttribute(r))){try{n=te(n)}catch(e){}K.set(e,t,n)}else n=void 0;return n}w.extend({hasData:function(e){return K.hasData(e)||J.hasData(e)},data:function(e,t,n){return K.access(e,t,n)},removeData:function(e,t){K.remove(e,t)},_data:function(e,t,n){return J.access(e,t,n)},_removeData:function(e,t){J.remove(e,t)}}),w.fn.extend({data:function(e,t){var n,r,i,o=this[0],a=o&&o.attributes;if(void 0===e){if(this.length&&(i=K.get(o),1===o.nodeType&&!J.get(o,"hasDataAttrs"))){n=a.length;while(n--)a[n]&&0===(r=a[n].name).indexOf("data-")&&(r=G(r.slice(5)),ne(o,r,i[r]));J.set(o,"hasDataAttrs",!0)}return i}return"object"==typeof e?this.each(function(){K.set(this,e)}):z(this,function(t){var n;if(o&&void 0===t){if(void 0!==(n=K.get(o,e)))return n;if(void 0!==(n=ne(o,e)))return n}else this.each(function(){K.set(this,e,t)})},null,t,arguments.length>1,null,!0)},removeData:function(e){return this.each(function(){K.remove(this,e)})}}),w.extend({queue:function(e,t,n){var r;if(e)return t=(t||"fx")+"queue",r=J.get(e,t),n&&(!r||Array.isArray(n)?r=J.access(e,t,w.makeArray(n)):r.push(n)),r||[]},dequeue:function(e,t){t=t||"fx";var n=w.queue(e,t),r=n.length,i=n.shift(),o=w._queueHooks(e,t),a=function(){w.dequeue(e,t)};"inprogress"===i&&(i=n.shift(),r--),i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,a,o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return J.get(e,n)||J.access(e,n,{empty:w.Callbacks("once memory").add(function(){J.remove(e,[t+"queue",n])})})}}),w.fn.extend({queue:function(e,t){var n=2;return"string"!=typeof e&&(t=e,e="fx",n--),arguments.length<n?w.queue(this[0],e):void 0===t?this:this.each(function(){var n=w.queue(this,e,t);w._queueHooks(this,e),"fx"===e&&"inprogress"!==n[0]&&w.dequeue(this,e)})},dequeue:function(e){return this.each(function(){w.dequeue(this,e)})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,t){var n,r=1,i=w.Deferred(),o=this,a=this.length,s=function(){--r||i.resolveWith(o,[o])};"string"!=typeof e&&(t=e,e=void 0),e=e||"fx";while(a--)(n=J.get(o[a],e+"queueHooks"))&&n.empty&&(r++,n.empty.add(s));return s(),i.promise(t)}});var re=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,ie=new RegExp("^(?:([+-])=|)("+re+")([a-z%]*)$","i"),oe=["Top","Right","Bottom","Left"],ae=function(e,t){return"none"===(e=t||e).style.display||""===e.style.display&&w.contains(e.ownerDocument,e)&&"none"===w.css(e,"display")},se=function(e,t,n,r){var i,o,a={};for(o in t)a[o]=e.style[o],e.style[o]=t[o];i=n.apply(e,r||[]);for(o in t)e.style[o]=a[o];return i};function ue(e,t,n,r){var i,o,a=20,s=r?function(){return r.cur()}:function(){return w.css(e,t,"")},u=s(),l=n&&n[3]||(w.cssNumber[t]?"":"px"),c=(w.cssNumber[t]||"px"!==l&&+u)&&ie.exec(w.css(e,t));if(c&&c[3]!==l){u/=2,l=l||c[3],c=+u||1;while(a--)w.style(e,t,c+l),(1-o)*(1-(o=s()/u||.5))<=0&&(a=0),c/=o;c*=2,w.style(e,t,c+l),n=n||[]}return n&&(c=+c||+u||0,i=n[1]?c+(n[1]+1)*n[2]:+n[2],r&&(r.unit=l,r.start=c,r.end=i)),i}var le={};function ce(e){var t,n=e.ownerDocument,r=e.nodeName,i=le[r];return i||(t=n.body.appendChild(n.createElement(r)),i=w.css(t,"display"),t.parentNode.removeChild(t),"none"===i&&(i="block"),le[r]=i,i)}function fe(e,t){for(var n,r,i=[],o=0,a=e.length;o<a;o++)(r=e[o]).style&&(n=r.style.display,t?("none"===n&&(i[o]=J.get(r,"display")||null,i[o]||(r.style.display="")),""===r.style.display&&ae(r)&&(i[o]=ce(r))):"none"!==n&&(i[o]="none",J.set(r,"display",n)));for(o=0;o<a;o++)null!=i[o]&&(e[o].style.display=i[o]);return e}w.fn.extend({show:function(){return fe(this,!0)},hide:function(){return fe(this)},toggle:function(e){return"boolean"==typeof e?e?this.show():this.hide():this.each(function(){ae(this)?w(this).show():w(this).hide()})}});var pe=/^(?:checkbox|radio)$/i,de=/<([a-z][^\/\0>\x20\t\r\n\f]+)/i,he=/^$|^module$|\/(?:java|ecma)script/i,ge={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};ge.optgroup=ge.option,ge.tbody=ge.tfoot=ge.colgroup=ge.caption=ge.thead,ge.th=ge.td;function ye(e,t){var n;return n="undefined"!=typeof e.getElementsByTagName?e.getElementsByTagName(t||"*"):"undefined"!=typeof e.querySelectorAll?e.querySelectorAll(t||"*"):[],void 0===t||t&&N(e,t)?w.merge([e],n):n}function ve(e,t){for(var n=0,r=e.length;n<r;n++)J.set(e[n],"globalEval",!t||J.get(t[n],"globalEval"))}var me=/<|&#?\w+;/;function xe(e,t,n,r,i){for(var o,a,s,u,l,c,f=t.createDocumentFragment(),p=[],d=0,h=e.length;d<h;d++)if((o=e[d])||0===o)if("object"===x(o))w.merge(p,o.nodeType?[o]:o);else if(me.test(o)){a=a||f.appendChild(t.createElement("div")),s=(de.exec(o)||["",""])[1].toLowerCase(),u=ge[s]||ge._default,a.innerHTML=u[1]+w.htmlPrefilter(o)+u[2],c=u[0];while(c--)a=a.lastChild;w.merge(p,a.childNodes),(a=f.firstChild).textContent=""}else p.push(t.createTextNode(o));f.textContent="",d=0;while(o=p[d++])if(r&&w.inArray(o,r)>-1)i&&i.push(o);else if(l=w.contains(o.ownerDocument,o),a=ye(f.appendChild(o),"script"),l&&ve(a),n){c=0;while(o=a[c++])he.test(o.type||"")&&n.push(o)}return f}!function(){var e=r.createDocumentFragment().appendChild(r.createElement("div")),t=r.createElement("input");t.setAttribute("type","radio"),t.setAttribute("checked","checked"),t.setAttribute("name","t"),e.appendChild(t),h.checkClone=e.cloneNode(!0).cloneNode(!0).lastChild.checked,e.innerHTML="<textarea>x</textarea>",h.noCloneChecked=!!e.cloneNode(!0).lastChild.defaultValue}();var be=r.documentElement,we=/^key/,Te=/^(?:mouse|pointer|contextmenu|drag|drop)|click/,Ce=/^([^.]*)(?:\.(.+)|)/;function Ee(){return!0}function ke(){return!1}function Se(){try{return r.activeElement}catch(e){}}function De(e,t,n,r,i,o){var a,s;if("object"==typeof t){"string"!=typeof n&&(r=r||n,n=void 0);for(s in t)De(e,s,n,r,t[s],o);return e}if(null==r&&null==i?(i=n,r=n=void 0):null==i&&("string"==typeof n?(i=r,r=void 0):(i=r,r=n,n=void 0)),!1===i)i=ke;else if(!i)return e;return 1===o&&(a=i,(i=function(e){return w().off(e),a.apply(this,arguments)}).guid=a.guid||(a.guid=w.guid++)),e.each(function(){w.event.add(this,t,i,r,n)})}w.event={global:{},add:function(e,t,n,r,i){var o,a,s,u,l,c,f,p,d,h,g,y=J.get(e);if(y){n.handler&&(n=(o=n).handler,i=o.selector),i&&w.find.matchesSelector(be,i),n.guid||(n.guid=w.guid++),(u=y.events)||(u=y.events={}),(a=y.handle)||(a=y.handle=function(t){return"undefined"!=typeof w&&w.event.triggered!==t.type?w.event.dispatch.apply(e,arguments):void 0}),l=(t=(t||"").match(M)||[""]).length;while(l--)d=g=(s=Ce.exec(t[l])||[])[1],h=(s[2]||"").split(".").sort(),d&&(f=w.event.special[d]||{},d=(i?f.delegateType:f.bindType)||d,f=w.event.special[d]||{},c=w.extend({type:d,origType:g,data:r,handler:n,guid:n.guid,selector:i,needsContext:i&&w.expr.match.needsContext.test(i),namespace:h.join(".")},o),(p=u[d])||((p=u[d]=[]).delegateCount=0,f.setup&&!1!==f.setup.call(e,r,h,a)||e.addEventListener&&e.addEventListener(d,a)),f.add&&(f.add.call(e,c),c.handler.guid||(c.handler.guid=n.guid)),i?p.splice(p.delegateCount++,0,c):p.push(c),w.event.global[d]=!0)}},remove:function(e,t,n,r,i){var o,a,s,u,l,c,f,p,d,h,g,y=J.hasData(e)&&J.get(e);if(y&&(u=y.events)){l=(t=(t||"").match(M)||[""]).length;while(l--)if(s=Ce.exec(t[l])||[],d=g=s[1],h=(s[2]||"").split(".").sort(),d){f=w.event.special[d]||{},p=u[d=(r?f.delegateType:f.bindType)||d]||[],s=s[2]&&new RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),a=o=p.length;while(o--)c=p[o],!i&&g!==c.origType||n&&n.guid!==c.guid||s&&!s.test(c.namespace)||r&&r!==c.selector&&("**"!==r||!c.selector)||(p.splice(o,1),c.selector&&p.delegateCount--,f.remove&&f.remove.call(e,c));a&&!p.length&&(f.teardown&&!1!==f.teardown.call(e,h,y.handle)||w.removeEvent(e,d,y.handle),delete u[d])}else for(d in u)w.event.remove(e,d+t[l],n,r,!0);w.isEmptyObject(u)&&J.remove(e,"handle events")}},dispatch:function(e){var t=w.event.fix(e),n,r,i,o,a,s,u=new Array(arguments.length),l=(J.get(this,"events")||{})[t.type]||[],c=w.event.special[t.type]||{};for(u[0]=t,n=1;n<arguments.length;n++)u[n]=arguments[n];if(t.delegateTarget=this,!c.preDispatch||!1!==c.preDispatch.call(this,t)){s=w.event.handlers.call(this,t,l),n=0;while((o=s[n++])&&!t.isPropagationStopped()){t.currentTarget=o.elem,r=0;while((a=o.handlers[r++])&&!t.isImmediatePropagationStopped())t.rnamespace&&!t.rnamespace.test(a.namespace)||(t.handleObj=a,t.data=a.data,void 0!==(i=((w.event.special[a.origType]||{}).handle||a.handler).apply(o.elem,u))&&!1===(t.result=i)&&(t.preventDefault(),t.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,t),t.result}},handlers:function(e,t){var n,r,i,o,a,s=[],u=t.delegateCount,l=e.target;if(u&&l.nodeType&&!("click"===e.type&&e.button>=1))for(;l!==this;l=l.parentNode||this)if(1===l.nodeType&&("click"!==e.type||!0!==l.disabled)){for(o=[],a={},n=0;n<u;n++)void 0===a[i=(r=t[n]).selector+" "]&&(a[i]=r.needsContext?w(i,this).index(l)>-1:w.find(i,this,null,[l]).length),a[i]&&o.push(r);o.length&&s.push({elem:l,handlers:o})}return l=this,u<t.length&&s.push({elem:l,handlers:t.slice(u)}),s},addProp:function(e,t){Object.defineProperty(w.Event.prototype,e,{enumerable:!0,configurable:!0,get:g(t)?function(){if(this.originalEvent)return t(this.originalEvent)}:function(){if(this.originalEvent)return this.originalEvent[e]},set:function(t){Object.defineProperty(this,e,{enumerable:!0,configurable:!0,writable:!0,value:t})}})},fix:function(e){return e[w.expando]?e:new w.Event(e)},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==Se()&&this.focus)return this.focus(),!1},delegateType:"focusin"},blur:{trigger:function(){if(this===Se()&&this.blur)return this.blur(),!1},delegateType:"focusout"},click:{trigger:function(){if("checkbox"===this.type&&this.click&&N(this,"input"))return this.click(),!1},_default:function(e){return N(e.target,"a")}},beforeunload:{postDispatch:function(e){void 0!==e.result&&e.originalEvent&&(e.originalEvent.returnValue=e.result)}}}},w.removeEvent=function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n)},w.Event=function(e,t){if(!(this instanceof w.Event))return new w.Event(e,t);e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||void 0===e.defaultPrevented&&!1===e.returnValue?Ee:ke,this.target=e.target&&3===e.target.nodeType?e.target.parentNode:e.target,this.currentTarget=e.currentTarget,this.relatedTarget=e.relatedTarget):this.type=e,t&&w.extend(this,t),this.timeStamp=e&&e.timeStamp||Date.now(),this[w.expando]=!0},w.Event.prototype={constructor:w.Event,isDefaultPrevented:ke,isPropagationStopped:ke,isImmediatePropagationStopped:ke,isSimulated:!1,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=Ee,e&&!this.isSimulated&&e.preventDefault()},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=Ee,e&&!this.isSimulated&&e.stopPropagation()},stopImmediatePropagation:function(){var e=this.originalEvent;this.isImmediatePropagationStopped=Ee,e&&!this.isSimulated&&e.stopImmediatePropagation(),this.stopPropagation()}},w.each({altKey:!0,bubbles:!0,cancelable:!0,changedTouches:!0,ctrlKey:!0,detail:!0,eventPhase:!0,metaKey:!0,pageX:!0,pageY:!0,shiftKey:!0,view:!0,"char":!0,charCode:!0,key:!0,keyCode:!0,button:!0,buttons:!0,clientX:!0,clientY:!0,offsetX:!0,offsetY:!0,pointerId:!0,pointerType:!0,screenX:!0,screenY:!0,targetTouches:!0,toElement:!0,touches:!0,which:function(e){var t=e.button;return null==e.which&&we.test(e.type)?null!=e.charCode?e.charCode:e.keyCode:!e.which&&void 0!==t&&Te.test(e.type)?1&t?1:2&t?3:4&t?2:0:e.which}},w.event.addProp),w.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(e,t){w.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,o=e.handleObj;return i&&(i===r||w.contains(r,i))||(e.type=o.origType,n=o.handler.apply(this,arguments),e.type=t),n}}}),w.fn.extend({on:function(e,t,n,r){return De(this,e,t,n,r)},one:function(e,t,n,r){return De(this,e,t,n,r,1)},off:function(e,t,n){var r,i;if(e&&e.preventDefault&&e.handleObj)return r=e.handleObj,w(e.delegateTarget).off(r.namespace?r.origType+"."+r.namespace:r.origType,r.selector,r.handler),this;if("object"==typeof e){for(i in e)this.off(i,t,e[i]);return this}return!1!==t&&"function"!=typeof t||(n=t,t=void 0),!1===n&&(n=ke),this.each(function(){w.event.remove(this,e,n,t)})}});var Ne=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,Ae=/<script|<style|<link/i,je=/checked\s*(?:[^=]|=\s*.checked.)/i,qe=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;function Le(e,t){return N(e,"table")&&N(11!==t.nodeType?t:t.firstChild,"tr")?w(e).children("tbody")[0]||e:e}function He(e){return e.type=(null!==e.getAttribute("type"))+"/"+e.type,e}function Oe(e){return"true/"===(e.type||"").slice(0,5)?e.type=e.type.slice(5):e.removeAttribute("type"),e}function Pe(e,t){var n,r,i,o,a,s,u,l;if(1===t.nodeType){if(J.hasData(e)&&(o=J.access(e),a=J.set(t,o),l=o.events)){delete a.handle,a.events={};for(i in l)for(n=0,r=l[i].length;n<r;n++)w.event.add(t,i,l[i][n])}K.hasData(e)&&(s=K.access(e),u=w.extend({},s),K.set(t,u))}}function Me(e,t){var n=t.nodeName.toLowerCase();"input"===n&&pe.test(e.type)?t.checked=e.checked:"input"!==n&&"textarea"!==n||(t.defaultValue=e.defaultValue)}function Re(e,t,n,r){t=a.apply([],t);var i,o,s,u,l,c,f=0,p=e.length,d=p-1,y=t[0],v=g(y);if(v||p>1&&"string"==typeof y&&!h.checkClone&&je.test(y))return e.each(function(i){var o=e.eq(i);v&&(t[0]=y.call(this,i,o.html())),Re(o,t,n,r)});if(p&&(i=xe(t,e[0].ownerDocument,!1,e,r),o=i.firstChild,1===i.childNodes.length&&(i=o),o||r)){for(u=(s=w.map(ye(i,"script"),He)).length;f<p;f++)l=i,f!==d&&(l=w.clone(l,!0,!0),u&&w.merge(s,ye(l,"script"))),n.call(e[f],l,f);if(u)for(c=s[s.length-1].ownerDocument,w.map(s,Oe),f=0;f<u;f++)l=s[f],he.test(l.type||"")&&!J.access(l,"globalEval")&&w.contains(c,l)&&(l.src&&"module"!==(l.type||"").toLowerCase()?w._evalUrl&&w._evalUrl(l.src):m(l.textContent.replace(qe,""),c,l))}return e}function Ie(e,t,n){for(var r,i=t?w.filter(t,e):e,o=0;null!=(r=i[o]);o++)n||1!==r.nodeType||w.cleanData(ye(r)),r.parentNode&&(n&&w.contains(r.ownerDocument,r)&&ve(ye(r,"script")),r.parentNode.removeChild(r));return e}w.extend({htmlPrefilter:function(e){return e.replace(Ne,"<$1></$2>")},clone:function(e,t,n){var r,i,o,a,s=e.cloneNode(!0),u=w.contains(e.ownerDocument,e);if(!(h.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||w.isXMLDoc(e)))for(a=ye(s),r=0,i=(o=ye(e)).length;r<i;r++)Me(o[r],a[r]);if(t)if(n)for(o=o||ye(e),a=a||ye(s),r=0,i=o.length;r<i;r++)Pe(o[r],a[r]);else Pe(e,s);return(a=ye(s,"script")).length>0&&ve(a,!u&&ye(e,"script")),s},cleanData:function(e){for(var t,n,r,i=w.event.special,o=0;void 0!==(n=e[o]);o++)if(Y(n)){if(t=n[J.expando]){if(t.events)for(r in t.events)i[r]?w.event.remove(n,r):w.removeEvent(n,r,t.handle);n[J.expando]=void 0}n[K.expando]&&(n[K.expando]=void 0)}}}),w.fn.extend({detach:function(e){return Ie(this,e,!0)},remove:function(e){return Ie(this,e)},text:function(e){return z(this,function(e){return void 0===e?w.text(this):this.empty().each(function(){1!==this.nodeType&&11!==this.nodeType&&9!==this.nodeType||(this.textContent=e)})},null,e,arguments.length)},append:function(){return Re(this,arguments,function(e){1!==this.nodeType&&11!==this.nodeType&&9!==this.nodeType||Le(this,e).appendChild(e)})},prepend:function(){return Re(this,arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=Le(this,e);t.insertBefore(e,t.firstChild)}})},before:function(){return Re(this,arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return Re(this,arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},empty:function(){for(var e,t=0;null!=(e=this[t]);t++)1===e.nodeType&&(w.cleanData(ye(e,!1)),e.textContent="");return this},clone:function(e,t){return e=null!=e&&e,t=null==t?e:t,this.map(function(){return w.clone(this,e,t)})},html:function(e){return z(this,function(e){var t=this[0]||{},n=0,r=this.length;if(void 0===e&&1===t.nodeType)return t.innerHTML;if("string"==typeof e&&!Ae.test(e)&&!ge[(de.exec(e)||["",""])[1].toLowerCase()]){e=w.htmlPrefilter(e);try{for(;n<r;n++)1===(t=this[n]||{}).nodeType&&(w.cleanData(ye(t,!1)),t.innerHTML=e);t=0}catch(e){}}t&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(){var e=[];return Re(this,arguments,function(t){var n=this.parentNode;w.inArray(this,e)<0&&(w.cleanData(ye(this)),n&&n.replaceChild(t,this))},e)}}),w.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){w.fn[e]=function(e){for(var n,r=[],i=w(e),o=i.length-1,a=0;a<=o;a++)n=a===o?this:this.clone(!0),w(i[a])[t](n),s.apply(r,n.get());return this.pushStack(r)}});var We=new RegExp("^("+re+")(?!px)[a-z%]+$","i"),$e=function(t){var n=t.ownerDocument.defaultView;return n&&n.opener||(n=e),n.getComputedStyle(t)},Be=new RegExp(oe.join("|"),"i");!function(){function t(){if(c){l.style.cssText="position:absolute;left:-11111px;width:60px;margin-top:1px;padding:0;border:0",c.style.cssText="position:relative;display:block;box-sizing:border-box;overflow:scroll;margin:auto;border:1px;padding:1px;width:60%;top:1%",be.appendChild(l).appendChild(c);var t=e.getComputedStyle(c);i="1%"!==t.top,u=12===n(t.marginLeft),c.style.right="60%",s=36===n(t.right),o=36===n(t.width),c.style.position="absolute",a=36===c.offsetWidth||"absolute",be.removeChild(l),c=null}}function n(e){return Math.round(parseFloat(e))}var i,o,a,s,u,l=r.createElement("div"),c=r.createElement("div");c.style&&(c.style.backgroundClip="content-box",c.cloneNode(!0).style.backgroundClip="",h.clearCloneStyle="content-box"===c.style.backgroundClip,w.extend(h,{boxSizingReliable:function(){return t(),o},pixelBoxStyles:function(){return t(),s},pixelPosition:function(){return t(),i},reliableMarginLeft:function(){return t(),u},scrollboxSize:function(){return t(),a}}))}();function Fe(e,t,n){var r,i,o,a,s=e.style;return(n=n||$e(e))&&(""!==(a=n.getPropertyValue(t)||n[t])||w.contains(e.ownerDocument,e)||(a=w.style(e,t)),!h.pixelBoxStyles()&&We.test(a)&&Be.test(t)&&(r=s.width,i=s.minWidth,o=s.maxWidth,s.minWidth=s.maxWidth=s.width=a,a=n.width,s.width=r,s.minWidth=i,s.maxWidth=o)),void 0!==a?a+"":a}function _e(e,t){return{get:function(){if(!e())return(this.get=t).apply(this,arguments);delete this.get}}}var ze=/^(none|table(?!-c[ea]).+)/,Xe=/^--/,Ue={position:"absolute",visibility:"hidden",display:"block"},Ve={letterSpacing:"0",fontWeight:"400"},Ge=["Webkit","Moz","ms"],Ye=r.createElement("div").style;function Qe(e){if(e in Ye)return e;var t=e[0].toUpperCase()+e.slice(1),n=Ge.length;while(n--)if((e=Ge[n]+t)in Ye)return e}function Je(e){var t=w.cssProps[e];return t||(t=w.cssProps[e]=Qe(e)||e),t}function Ke(e,t,n){var r=ie.exec(t);return r?Math.max(0,r[2]-(n||0))+(r[3]||"px"):t}function Ze(e,t,n,r,i,o){var a="width"===t?1:0,s=0,u=0;if(n===(r?"border":"content"))return 0;for(;a<4;a+=2)"margin"===n&&(u+=w.css(e,n+oe[a],!0,i)),r?("content"===n&&(u-=w.css(e,"padding"+oe[a],!0,i)),"margin"!==n&&(u-=w.css(e,"border"+oe[a]+"Width",!0,i))):(u+=w.css(e,"padding"+oe[a],!0,i),"padding"!==n?u+=w.css(e,"border"+oe[a]+"Width",!0,i):s+=w.css(e,"border"+oe[a]+"Width",!0,i));return!r&&o>=0&&(u+=Math.max(0,Math.ceil(e["offset"+t[0].toUpperCase()+t.slice(1)]-o-u-s-.5))),u}function et(e,t,n){var r=$e(e),i=Fe(e,t,r),o="border-box"===w.css(e,"boxSizing",!1,r),a=o;if(We.test(i)){if(!n)return i;i="auto"}return a=a&&(h.boxSizingReliable()||i===e.style[t]),("auto"===i||!parseFloat(i)&&"inline"===w.css(e,"display",!1,r))&&(i=e["offset"+t[0].toUpperCase()+t.slice(1)],a=!0),(i=parseFloat(i)||0)+Ze(e,t,n||(o?"border":"content"),a,r,i)+"px"}w.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Fe(e,"opacity");return""===n?"1":n}}}},cssNumber:{animationIterationCount:!0,columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{},style:function(e,t,n,r){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var i,o,a,s=G(t),u=Xe.test(t),l=e.style;if(u||(t=Je(s)),a=w.cssHooks[t]||w.cssHooks[s],void 0===n)return a&&"get"in a&&void 0!==(i=a.get(e,!1,r))?i:l[t];"string"==(o=typeof n)&&(i=ie.exec(n))&&i[1]&&(n=ue(e,t,i),o="number"),null!=n&&n===n&&("number"===o&&(n+=i&&i[3]||(w.cssNumber[s]?"":"px")),h.clearCloneStyle||""!==n||0!==t.indexOf("background")||(l[t]="inherit"),a&&"set"in a&&void 0===(n=a.set(e,n,r))||(u?l.setProperty(t,n):l[t]=n))}},css:function(e,t,n,r){var i,o,a,s=G(t);return Xe.test(t)||(t=Je(s)),(a=w.cssHooks[t]||w.cssHooks[s])&&"get"in a&&(i=a.get(e,!0,n)),void 0===i&&(i=Fe(e,t,r)),"normal"===i&&t in Ve&&(i=Ve[t]),""===n||n?(o=parseFloat(i),!0===n||isFinite(o)?o||0:i):i}}),w.each(["height","width"],function(e,t){w.cssHooks[t]={get:function(e,n,r){if(n)return!ze.test(w.css(e,"display"))||e.getClientRects().length&&e.getBoundingClientRect().width?et(e,t,r):se(e,Ue,function(){return et(e,t,r)})},set:function(e,n,r){var i,o=$e(e),a="border-box"===w.css(e,"boxSizing",!1,o),s=r&&Ze(e,t,r,a,o);return a&&h.scrollboxSize()===o.position&&(s-=Math.ceil(e["offset"+t[0].toUpperCase()+t.slice(1)]-parseFloat(o[t])-Ze(e,t,"border",!1,o)-.5)),s&&(i=ie.exec(n))&&"px"!==(i[3]||"px")&&(e.style[t]=n,n=w.css(e,t)),Ke(e,n,s)}}}),w.cssHooks.marginLeft=_e(h.reliableMarginLeft,function(e,t){if(t)return(parseFloat(Fe(e,"marginLeft"))||e.getBoundingClientRect().left-se(e,{marginLeft:0},function(){return e.getBoundingClientRect().left}))+"px"}),w.each({margin:"",padding:"",border:"Width"},function(e,t){w.cssHooks[e+t]={expand:function(n){for(var r=0,i={},o="string"==typeof n?n.split(" "):[n];r<4;r++)i[e+oe[r]+t]=o[r]||o[r-2]||o[0];return i}},"margin"!==e&&(w.cssHooks[e+t].set=Ke)}),w.fn.extend({css:function(e,t){return z(this,function(e,t,n){var r,i,o={},a=0;if(Array.isArray(t)){for(r=$e(e),i=t.length;a<i;a++)o[t[a]]=w.css(e,t[a],!1,r);return o}return void 0!==n?w.style(e,t,n):w.css(e,t)},e,t,arguments.length>1)}});function tt(e,t,n,r,i){return new tt.prototype.init(e,t,n,r,i)}w.Tween=tt,tt.prototype={constructor:tt,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||w.easing._default,this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(w.cssNumber[n]?"":"px")},cur:function(){var e=tt.propHooks[this.prop];return e&&e.get?e.get(this):tt.propHooks._default.get(this)},run:function(e){var t,n=tt.propHooks[this.prop];return this.options.duration?this.pos=t=w.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):this.pos=t=e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):tt.propHooks._default.set(this),this}},tt.prototype.init.prototype=tt.prototype,tt.propHooks={_default:{get:function(e){var t;return 1!==e.elem.nodeType||null!=e.elem[e.prop]&&null==e.elem.style[e.prop]?e.elem[e.prop]:(t=w.css(e.elem,e.prop,""))&&"auto"!==t?t:0},set:function(e){w.fx.step[e.prop]?w.fx.step[e.prop](e):1!==e.elem.nodeType||null==e.elem.style[w.cssProps[e.prop]]&&!w.cssHooks[e.prop]?e.elem[e.prop]=e.now:w.style(e.elem,e.prop,e.now+e.unit)}}},tt.propHooks.scrollTop=tt.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},w.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2},_default:"swing"},w.fx=tt.prototype.init,w.fx.step={};var nt,rt,it=/^(?:toggle|show|hide)$/,ot=/queueHooks$/;function at(){rt&&(!1===r.hidden&&e.requestAnimationFrame?e.requestAnimationFrame(at):e.setTimeout(at,w.fx.interval),w.fx.tick())}function st(){return e.setTimeout(function(){nt=void 0}),nt=Date.now()}function ut(e,t){var n,r=0,i={height:e};for(t=t?1:0;r<4;r+=2-t)i["margin"+(n=oe[r])]=i["padding"+n]=e;return t&&(i.opacity=i.width=e),i}function lt(e,t,n){for(var r,i=(pt.tweeners[t]||[]).concat(pt.tweeners["*"]),o=0,a=i.length;o<a;o++)if(r=i[o].call(n,t,e))return r}function ct(e,t,n){var r,i,o,a,s,u,l,c,f="width"in t||"height"in t,p=this,d={},h=e.style,g=e.nodeType&&ae(e),y=J.get(e,"fxshow");n.queue||(null==(a=w._queueHooks(e,"fx")).unqueued&&(a.unqueued=0,s=a.empty.fire,a.empty.fire=function(){a.unqueued||s()}),a.unqueued++,p.always(function(){p.always(function(){a.unqueued--,w.queue(e,"fx").length||a.empty.fire()})}));for(r in t)if(i=t[r],it.test(i)){if(delete t[r],o=o||"toggle"===i,i===(g?"hide":"show")){if("show"!==i||!y||void 0===y[r])continue;g=!0}d[r]=y&&y[r]||w.style(e,r)}if((u=!w.isEmptyObject(t))||!w.isEmptyObject(d)){f&&1===e.nodeType&&(n.overflow=[h.overflow,h.overflowX,h.overflowY],null==(l=y&&y.display)&&(l=J.get(e,"display")),"none"===(c=w.css(e,"display"))&&(l?c=l:(fe([e],!0),l=e.style.display||l,c=w.css(e,"display"),fe([e]))),("inline"===c||"inline-block"===c&&null!=l)&&"none"===w.css(e,"float")&&(u||(p.done(function(){h.display=l}),null==l&&(c=h.display,l="none"===c?"":c)),h.display="inline-block")),n.overflow&&(h.overflow="hidden",p.always(function(){h.overflow=n.overflow[0],h.overflowX=n.overflow[1],h.overflowY=n.overflow[2]})),u=!1;for(r in d)u||(y?"hidden"in y&&(g=y.hidden):y=J.access(e,"fxshow",{display:l}),o&&(y.hidden=!g),g&&fe([e],!0),p.done(function(){g||fe([e]),J.remove(e,"fxshow");for(r in d)w.style(e,r,d[r])})),u=lt(g?y[r]:0,r,p),r in y||(y[r]=u.start,g&&(u.end=u.start,u.start=0))}}function ft(e,t){var n,r,i,o,a;for(n in e)if(r=G(n),i=t[r],o=e[n],Array.isArray(o)&&(i=o[1],o=e[n]=o[0]),n!==r&&(e[r]=o,delete e[n]),(a=w.cssHooks[r])&&"expand"in a){o=a.expand(o),delete e[r];for(n in o)n in e||(e[n]=o[n],t[n]=i)}else t[r]=i}function pt(e,t,n){var r,i,o=0,a=pt.prefilters.length,s=w.Deferred().always(function(){delete u.elem}),u=function(){if(i)return!1;for(var t=nt||st(),n=Math.max(0,l.startTime+l.duration-t),r=1-(n/l.duration||0),o=0,a=l.tweens.length;o<a;o++)l.tweens[o].run(r);return s.notifyWith(e,[l,r,n]),r<1&&a?n:(a||s.notifyWith(e,[l,1,0]),s.resolveWith(e,[l]),!1)},l=s.promise({elem:e,props:w.extend({},t),opts:w.extend(!0,{specialEasing:{},easing:w.easing._default},n),originalProperties:t,originalOptions:n,startTime:nt||st(),duration:n.duration,tweens:[],createTween:function(t,n){var r=w.Tween(e,l.opts,t,n,l.opts.specialEasing[t]||l.opts.easing);return l.tweens.push(r),r},stop:function(t){var n=0,r=t?l.tweens.length:0;if(i)return this;for(i=!0;n<r;n++)l.tweens[n].run(1);return t?(s.notifyWith(e,[l,1,0]),s.resolveWith(e,[l,t])):s.rejectWith(e,[l,t]),this}}),c=l.props;for(ft(c,l.opts.specialEasing);o<a;o++)if(r=pt.prefilters[o].call(l,e,c,l.opts))return g(r.stop)&&(w._queueHooks(l.elem,l.opts.queue).stop=r.stop.bind(r)),r;return w.map(c,lt,l),g(l.opts.start)&&l.opts.start.call(e,l),l.progress(l.opts.progress).done(l.opts.done,l.opts.complete).fail(l.opts.fail).always(l.opts.always),w.fx.timer(w.extend(u,{elem:e,anim:l,queue:l.opts.queue})),l}w.Animation=w.extend(pt,{tweeners:{"*":[function(e,t){var n=this.createTween(e,t);return ue(n.elem,e,ie.exec(t),n),n}]},tweener:function(e,t){g(e)?(t=e,e=["*"]):e=e.match(M);for(var n,r=0,i=e.length;r<i;r++)n=e[r],pt.tweeners[n]=pt.tweeners[n]||[],pt.tweeners[n].unshift(t)},prefilters:[ct],prefilter:function(e,t){t?pt.prefilters.unshift(e):pt.prefilters.push(e)}}),w.speed=function(e,t,n){var r=e&&"object"==typeof e?w.extend({},e):{complete:n||!n&&t||g(e)&&e,duration:e,easing:n&&t||t&&!g(t)&&t};return w.fx.off?r.duration=0:"number"!=typeof r.duration&&(r.duration in w.fx.speeds?r.duration=w.fx.speeds[r.duration]:r.duration=w.fx.speeds._default),null!=r.queue&&!0!==r.queue||(r.queue="fx"),r.old=r.complete,r.complete=function(){g(r.old)&&r.old.call(this),r.queue&&w.dequeue(this,r.queue)},r},w.fn.extend({fadeTo:function(e,t,n,r){return this.filter(ae).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=w.isEmptyObject(e),o=w.speed(t,n,r),a=function(){var t=pt(this,w.extend({},e),o);(i||J.get(this,"finish"))&&t.stop(!0)};return a.finish=a,i||!1===o.queue?this.each(a):this.queue(o.queue,a)},stop:function(e,t,n){var r=function(e){var t=e.stop;delete e.stop,t(n)};return"string"!=typeof e&&(n=t,t=e,e=void 0),t&&!1!==e&&this.queue(e||"fx",[]),this.each(function(){var t=!0,i=null!=e&&e+"queueHooks",o=w.timers,a=J.get(this);if(i)a[i]&&a[i].stop&&r(a[i]);else for(i in a)a[i]&&a[i].stop&&ot.test(i)&&r(a[i]);for(i=o.length;i--;)o[i].elem!==this||null!=e&&o[i].queue!==e||(o[i].anim.stop(n),t=!1,o.splice(i,1));!t&&n||w.dequeue(this,e)})},finish:function(e){return!1!==e&&(e=e||"fx"),this.each(function(){var t,n=J.get(this),r=n[e+"queue"],i=n[e+"queueHooks"],o=w.timers,a=r?r.length:0;for(n.finish=!0,w.queue(this,e,[]),i&&i.stop&&i.stop.call(this,!0),t=o.length;t--;)o[t].elem===this&&o[t].queue===e&&(o[t].anim.stop(!0),o.splice(t,1));for(t=0;t<a;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}}),w.each(["toggle","show","hide"],function(e,t){var n=w.fn[t];w.fn[t]=function(e,r,i){return null==e||"boolean"==typeof e?n.apply(this,arguments):this.animate(ut(t,!0),e,r,i)}}),w.each({slideDown:ut("show"),slideUp:ut("hide"),slideToggle:ut("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){w.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),w.timers=[],w.fx.tick=function(){var e,t=0,n=w.timers;for(nt=Date.now();t<n.length;t++)(e=n[t])()||n[t]!==e||n.splice(t--,1);n.length||w.fx.stop(),nt=void 0},w.fx.timer=function(e){w.timers.push(e),w.fx.start()},w.fx.interval=13,w.fx.start=function(){rt||(rt=!0,at())},w.fx.stop=function(){rt=null},w.fx.speeds={slow:600,fast:200,_default:400},w.fn.delay=function(t,n){return t=w.fx?w.fx.speeds[t]||t:t,n=n||"fx",this.queue(n,function(n,r){var i=e.setTimeout(n,t);r.stop=function(){e.clearTimeout(i)}})},function(){var e=r.createElement("input"),t=r.createElement("select").appendChild(r.createElement("option"));e.type="checkbox",h.checkOn=""!==e.value,h.optSelected=t.selected,(e=r.createElement("input")).value="t",e.type="radio",h.radioValue="t"===e.value}();var dt,ht=w.expr.attrHandle;w.fn.extend({attr:function(e,t){return z(this,w.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){w.removeAttr(this,e)})}}),w.extend({attr:function(e,t,n){var r,i,o=e.nodeType;if(3!==o&&8!==o&&2!==o)return"undefined"==typeof e.getAttribute?w.prop(e,t,n):(1===o&&w.isXMLDoc(e)||(i=w.attrHooks[t.toLowerCase()]||(w.expr.match.bool.test(t)?dt:void 0)),void 0!==n?null===n?void w.removeAttr(e,t):i&&"set"in i&&void 0!==(r=i.set(e,n,t))?r:(e.setAttribute(t,n+""),n):i&&"get"in i&&null!==(r=i.get(e,t))?r:null==(r=w.find.attr(e,t))?void 0:r)},attrHooks:{type:{set:function(e,t){if(!h.radioValue&&"radio"===t&&N(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},removeAttr:function(e,t){var n,r=0,i=t&&t.match(M);if(i&&1===e.nodeType)while(n=i[r++])e.removeAttribute(n)}}),dt={set:function(e,t,n){return!1===t?w.removeAttr(e,n):e.setAttribute(n,n),n}},w.each(w.expr.match.bool.source.match(/\w+/g),function(e,t){var n=ht[t]||w.find.attr;ht[t]=function(e,t,r){var i,o,a=t.toLowerCase();return r||(o=ht[a],ht[a]=i,i=null!=n(e,t,r)?a:null,ht[a]=o),i}});var gt=/^(?:input|select|textarea|button)$/i,yt=/^(?:a|area)$/i;w.fn.extend({prop:function(e,t){return z(this,w.prop,e,t,arguments.length>1)},removeProp:function(e){return this.each(function(){delete this[w.propFix[e]||e]})}}),w.extend({prop:function(e,t,n){var r,i,o=e.nodeType;if(3!==o&&8!==o&&2!==o)return 1===o&&w.isXMLDoc(e)||(t=w.propFix[t]||t,i=w.propHooks[t]),void 0!==n?i&&"set"in i&&void 0!==(r=i.set(e,n,t))?r:e[t]=n:i&&"get"in i&&null!==(r=i.get(e,t))?r:e[t]},propHooks:{tabIndex:{get:function(e){var t=w.find.attr(e,"tabindex");return t?parseInt(t,10):gt.test(e.nodeName)||yt.test(e.nodeName)&&e.href?0:-1}}},propFix:{"for":"htmlFor","class":"className"}}),h.optSelected||(w.propHooks.selected={get:function(e){var t=e.parentNode;return t&&t.parentNode&&t.parentNode.selectedIndex,null},set:function(e){var t=e.parentNode;t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex)}}),w.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){w.propFix[this.toLowerCase()]=this});function vt(e){return(e.match(M)||[]).join(" ")}function mt(e){return e.getAttribute&&e.getAttribute("class")||""}function xt(e){return Array.isArray(e)?e:"string"==typeof e?e.match(M)||[]:[]}w.fn.extend({addClass:function(e){var t,n,r,i,o,a,s,u=0;if(g(e))return this.each(function(t){w(this).addClass(e.call(this,t,mt(this)))});if((t=xt(e)).length)while(n=this[u++])if(i=mt(n),r=1===n.nodeType&&" "+vt(i)+" "){a=0;while(o=t[a++])r.indexOf(" "+o+" ")<0&&(r+=o+" ");i!==(s=vt(r))&&n.setAttribute("class",s)}return this},removeClass:function(e){var t,n,r,i,o,a,s,u=0;if(g(e))return this.each(function(t){w(this).removeClass(e.call(this,t,mt(this)))});if(!arguments.length)return this.attr("class","");if((t=xt(e)).length)while(n=this[u++])if(i=mt(n),r=1===n.nodeType&&" "+vt(i)+" "){a=0;while(o=t[a++])while(r.indexOf(" "+o+" ")>-1)r=r.replace(" "+o+" "," ");i!==(s=vt(r))&&n.setAttribute("class",s)}return this},toggleClass:function(e,t){var n=typeof e,r="string"===n||Array.isArray(e);return"boolean"==typeof t&&r?t?this.addClass(e):this.removeClass(e):g(e)?this.each(function(n){w(this).toggleClass(e.call(this,n,mt(this),t),t)}):this.each(function(){var t,i,o,a;if(r){i=0,o=w(this),a=xt(e);while(t=a[i++])o.hasClass(t)?o.removeClass(t):o.addClass(t)}else void 0!==e&&"boolean"!==n||((t=mt(this))&&J.set(this,"__className__",t),this.setAttribute&&this.setAttribute("class",t||!1===e?"":J.get(this,"__className__")||""))})},hasClass:function(e){var t,n,r=0;t=" "+e+" ";while(n=this[r++])if(1===n.nodeType&&(" "+vt(mt(n))+" ").indexOf(t)>-1)return!0;return!1}});var bt=/\r/g;w.fn.extend({val:function(e){var t,n,r,i=this[0];{if(arguments.length)return r=g(e),this.each(function(n){var i;1===this.nodeType&&(null==(i=r?e.call(this,n,w(this).val()):e)?i="":"number"==typeof i?i+="":Array.isArray(i)&&(i=w.map(i,function(e){return null==e?"":e+""})),(t=w.valHooks[this.type]||w.valHooks[this.nodeName.toLowerCase()])&&"set"in t&&void 0!==t.set(this,i,"value")||(this.value=i))});if(i)return(t=w.valHooks[i.type]||w.valHooks[i.nodeName.toLowerCase()])&&"get"in t&&void 0!==(n=t.get(i,"value"))?n:"string"==typeof(n=i.value)?n.replace(bt,""):null==n?"":n}}}),w.extend({valHooks:{option:{get:function(e){var t=w.find.attr(e,"value");return null!=t?t:vt(w.text(e))}},select:{get:function(e){var t,n,r,i=e.options,o=e.selectedIndex,a="select-one"===e.type,s=a?null:[],u=a?o+1:i.length;for(r=o<0?u:a?o:0;r<u;r++)if(((n=i[r]).selected||r===o)&&!n.disabled&&(!n.parentNode.disabled||!N(n.parentNode,"optgroup"))){if(t=w(n).val(),a)return t;s.push(t)}return s},set:function(e,t){var n,r,i=e.options,o=w.makeArray(t),a=i.length;while(a--)((r=i[a]).selected=w.inArray(w.valHooks.option.get(r),o)>-1)&&(n=!0);return n||(e.selectedIndex=-1),o}}}}),w.each(["radio","checkbox"],function(){w.valHooks[this]={set:function(e,t){if(Array.isArray(t))return e.checked=w.inArray(w(e).val(),t)>-1}},h.checkOn||(w.valHooks[this].get=function(e){return null===e.getAttribute("value")?"on":e.value})}),h.focusin="onfocusin"in e;var wt=/^(?:focusinfocus|focusoutblur)$/,Tt=function(e){e.stopPropagation()};w.extend(w.event,{trigger:function(t,n,i,o){var a,s,u,l,c,p,d,h,v=[i||r],m=f.call(t,"type")?t.type:t,x=f.call(t,"namespace")?t.namespace.split("."):[];if(s=h=u=i=i||r,3!==i.nodeType&&8!==i.nodeType&&!wt.test(m+w.event.triggered)&&(m.indexOf(".")>-1&&(m=(x=m.split(".")).shift(),x.sort()),c=m.indexOf(":")<0&&"on"+m,t=t[w.expando]?t:new w.Event(m,"object"==typeof t&&t),t.isTrigger=o?2:3,t.namespace=x.join("."),t.rnamespace=t.namespace?new RegExp("(^|\\.)"+x.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,t.result=void 0,t.target||(t.target=i),n=null==n?[t]:w.makeArray(n,[t]),d=w.event.special[m]||{},o||!d.trigger||!1!==d.trigger.apply(i,n))){if(!o&&!d.noBubble&&!y(i)){for(l=d.delegateType||m,wt.test(l+m)||(s=s.parentNode);s;s=s.parentNode)v.push(s),u=s;u===(i.ownerDocument||r)&&v.push(u.defaultView||u.parentWindow||e)}a=0;while((s=v[a++])&&!t.isPropagationStopped())h=s,t.type=a>1?l:d.bindType||m,(p=(J.get(s,"events")||{})[t.type]&&J.get(s,"handle"))&&p.apply(s,n),(p=c&&s[c])&&p.apply&&Y(s)&&(t.result=p.apply(s,n),!1===t.result&&t.preventDefault());return t.type=m,o||t.isDefaultPrevented()||d._default&&!1!==d._default.apply(v.pop(),n)||!Y(i)||c&&g(i[m])&&!y(i)&&((u=i[c])&&(i[c]=null),w.event.triggered=m,t.isPropagationStopped()&&h.addEventListener(m,Tt),i[m](),t.isPropagationStopped()&&h.removeEventListener(m,Tt),w.event.triggered=void 0,u&&(i[c]=u)),t.result}},simulate:function(e,t,n){var r=w.extend(new w.Event,n,{type:e,isSimulated:!0});w.event.trigger(r,null,t)}}),w.fn.extend({trigger:function(e,t){return this.each(function(){w.event.trigger(e,t,this)})},triggerHandler:function(e,t){var n=this[0];if(n)return w.event.trigger(e,t,n,!0)}}),h.focusin||w.each({focus:"focusin",blur:"focusout"},function(e,t){var n=function(e){w.event.simulate(t,e.target,w.event.fix(e))};w.event.special[t]={setup:function(){var r=this.ownerDocument||this,i=J.access(r,t);i||r.addEventListener(e,n,!0),J.access(r,t,(i||0)+1)},teardown:function(){var r=this.ownerDocument||this,i=J.access(r,t)-1;i?J.access(r,t,i):(r.removeEventListener(e,n,!0),J.remove(r,t))}}});var Ct=e.location,Et=Date.now(),kt=/\?/;w.parseXML=function(t){var n;if(!t||"string"!=typeof t)return null;try{n=(new e.DOMParser).parseFromString(t,"text/xml")}catch(e){n=void 0}return n&&!n.getElementsByTagName("parsererror").length||w.error("Invalid XML: "+t),n};var St=/\[\]$/,Dt=/\r?\n/g,Nt=/^(?:submit|button|image|reset|file)$/i,At=/^(?:input|select|textarea|keygen)/i;function jt(e,t,n,r){var i;if(Array.isArray(t))w.each(t,function(t,i){n||St.test(e)?r(e,i):jt(e+"["+("object"==typeof i&&null!=i?t:"")+"]",i,n,r)});else if(n||"object"!==x(t))r(e,t);else for(i in t)jt(e+"["+i+"]",t[i],n,r)}w.param=function(e,t){var n,r=[],i=function(e,t){var n=g(t)?t():t;r[r.length]=encodeURIComponent(e)+"="+encodeURIComponent(null==n?"":n)};if(Array.isArray(e)||e.jquery&&!w.isPlainObject(e))w.each(e,function(){i(this.name,this.value)});else for(n in e)jt(n,e[n],t,i);return r.join("&")},w.fn.extend({serialize:function(){return w.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=w.prop(this,"elements");return e?w.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!w(this).is(":disabled")&&At.test(this.nodeName)&&!Nt.test(e)&&(this.checked||!pe.test(e))}).map(function(e,t){var n=w(this).val();return null==n?null:Array.isArray(n)?w.map(n,function(e){return{name:t.name,value:e.replace(Dt,"\r\n")}}):{name:t.name,value:n.replace(Dt,"\r\n")}}).get()}});var qt=/%20/g,Lt=/#.*$/,Ht=/([?&])_=[^&]*/,Ot=/^(.*?):[ \t]*([^\r\n]*)$/gm,Pt=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Mt=/^(?:GET|HEAD)$/,Rt=/^\/\//,It={},Wt={},$t="*/".concat("*"),Bt=r.createElement("a");Bt.href=Ct.href;function Ft(e){return function(t,n){"string"!=typeof t&&(n=t,t="*");var r,i=0,o=t.toLowerCase().match(M)||[];if(g(n))while(r=o[i++])"+"===r[0]?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function _t(e,t,n,r){var i={},o=e===Wt;function a(s){var u;return i[s]=!0,w.each(e[s]||[],function(e,s){var l=s(t,n,r);return"string"!=typeof l||o||i[l]?o?!(u=l):void 0:(t.dataTypes.unshift(l),a(l),!1)}),u}return a(t.dataTypes[0])||!i["*"]&&a("*")}function zt(e,t){var n,r,i=w.ajaxSettings.flatOptions||{};for(n in t)void 0!==t[n]&&((i[n]?e:r||(r={}))[n]=t[n]);return r&&w.extend(!0,e,r),e}function Xt(e,t,n){var r,i,o,a,s=e.contents,u=e.dataTypes;while("*"===u[0])u.shift(),void 0===r&&(r=e.mimeType||t.getResponseHeader("Content-Type"));if(r)for(i in s)if(s[i]&&s[i].test(r)){u.unshift(i);break}if(u[0]in n)o=u[0];else{for(i in n){if(!u[0]||e.converters[i+" "+u[0]]){o=i;break}a||(a=i)}o=o||a}if(o)return o!==u[0]&&u.unshift(o),n[o]}function Ut(e,t,n,r){var i,o,a,s,u,l={},c=e.dataTypes.slice();if(c[1])for(a in e.converters)l[a.toLowerCase()]=e.converters[a];o=c.shift();while(o)if(e.responseFields[o]&&(n[e.responseFields[o]]=t),!u&&r&&e.dataFilter&&(t=e.dataFilter(t,e.dataType)),u=o,o=c.shift())if("*"===o)o=u;else if("*"!==u&&u!==o){if(!(a=l[u+" "+o]||l["* "+o]))for(i in l)if((s=i.split(" "))[1]===o&&(a=l[u+" "+s[0]]||l["* "+s[0]])){!0===a?a=l[i]:!0!==l[i]&&(o=s[0],c.unshift(s[1]));break}if(!0!==a)if(a&&e["throws"])t=a(t);else try{t=a(t)}catch(e){return{state:"parsererror",error:a?e:"No conversion from "+u+" to "+o}}}return{state:"success",data:t}}w.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:Ct.href,type:"GET",isLocal:Pt.test(Ct.protocol),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":$t,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/\bxml\b/,html:/\bhtml/,json:/\bjson\b/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":JSON.parse,"text xml":w.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?zt(zt(e,w.ajaxSettings),t):zt(w.ajaxSettings,e)},ajaxPrefilter:Ft(It),ajaxTransport:Ft(Wt),ajax:function(t,n){"object"==typeof t&&(n=t,t=void 0),n=n||{};var i,o,a,s,u,l,c,f,p,d,h=w.ajaxSetup({},n),g=h.context||h,y=h.context&&(g.nodeType||g.jquery)?w(g):w.event,v=w.Deferred(),m=w.Callbacks("once memory"),x=h.statusCode||{},b={},T={},C="canceled",E={readyState:0,getResponseHeader:function(e){var t;if(c){if(!s){s={};while(t=Ot.exec(a))s[t[1].toLowerCase()]=t[2]}t=s[e.toLowerCase()]}return null==t?null:t},getAllResponseHeaders:function(){return c?a:null},setRequestHeader:function(e,t){return null==c&&(e=T[e.toLowerCase()]=T[e.toLowerCase()]||e,b[e]=t),this},overrideMimeType:function(e){return null==c&&(h.mimeType=e),this},statusCode:function(e){var t;if(e)if(c)E.always(e[E.status]);else for(t in e)x[t]=[x[t],e[t]];return this},abort:function(e){var t=e||C;return i&&i.abort(t),k(0,t),this}};if(v.promise(E),h.url=((t||h.url||Ct.href)+"").replace(Rt,Ct.protocol+"//"),h.type=n.method||n.type||h.method||h.type,h.dataTypes=(h.dataType||"*").toLowerCase().match(M)||[""],null==h.crossDomain){l=r.createElement("a");try{l.href=h.url,l.href=l.href,h.crossDomain=Bt.protocol+"//"+Bt.host!=l.protocol+"//"+l.host}catch(e){h.crossDomain=!0}}if(h.data&&h.processData&&"string"!=typeof h.data&&(h.data=w.param(h.data,h.traditional)),_t(It,h,n,E),c)return E;(f=w.event&&h.global)&&0==w.active++&&w.event.trigger("ajaxStart"),h.type=h.type.toUpperCase(),h.hasContent=!Mt.test(h.type),o=h.url.replace(Lt,""),h.hasContent?h.data&&h.processData&&0===(h.contentType||"").indexOf("application/x-www-form-urlencoded")&&(h.data=h.data.replace(qt,"+")):(d=h.url.slice(o.length),h.data&&(h.processData||"string"==typeof h.data)&&(o+=(kt.test(o)?"&":"?")+h.data,delete h.data),!1===h.cache&&(o=o.replace(Ht,"$1"),d=(kt.test(o)?"&":"?")+"_="+Et+++d),h.url=o+d),h.ifModified&&(w.lastModified[o]&&E.setRequestHeader("If-Modified-Since",w.lastModified[o]),w.etag[o]&&E.setRequestHeader("If-None-Match",w.etag[o])),(h.data&&h.hasContent&&!1!==h.contentType||n.contentType)&&E.setRequestHeader("Content-Type",h.contentType),E.setRequestHeader("Accept",h.dataTypes[0]&&h.accepts[h.dataTypes[0]]?h.accepts[h.dataTypes[0]]+("*"!==h.dataTypes[0]?", "+$t+"; q=0.01":""):h.accepts["*"]);for(p in h.headers)E.setRequestHeader(p,h.headers[p]);if(h.beforeSend&&(!1===h.beforeSend.call(g,E,h)||c))return E.abort();if(C="abort",m.add(h.complete),E.done(h.success),E.fail(h.error),i=_t(Wt,h,n,E)){if(E.readyState=1,f&&y.trigger("ajaxSend",[E,h]),c)return E;h.async&&h.timeout>0&&(u=e.setTimeout(function(){E.abort("timeout")},h.timeout));try{c=!1,i.send(b,k)}catch(e){if(c)throw e;k(-1,e)}}else k(-1,"No Transport");function k(t,n,r,s){var l,p,d,b,T,C=n;c||(c=!0,u&&e.clearTimeout(u),i=void 0,a=s||"",E.readyState=t>0?4:0,l=t>=200&&t<300||304===t,r&&(b=Xt(h,E,r)),b=Ut(h,b,E,l),l?(h.ifModified&&((T=E.getResponseHeader("Last-Modified"))&&(w.lastModified[o]=T),(T=E.getResponseHeader("etag"))&&(w.etag[o]=T)),204===t||"HEAD"===h.type?C="nocontent":304===t?C="notmodified":(C=b.state,p=b.data,l=!(d=b.error))):(d=C,!t&&C||(C="error",t<0&&(t=0))),E.status=t,E.statusText=(n||C)+"",l?v.resolveWith(g,[p,C,E]):v.rejectWith(g,[E,C,d]),E.statusCode(x),x=void 0,f&&y.trigger(l?"ajaxSuccess":"ajaxError",[E,h,l?p:d]),m.fireWith(g,[E,C]),f&&(y.trigger("ajaxComplete",[E,h]),--w.active||w.event.trigger("ajaxStop")))}return E},getJSON:function(e,t,n){return w.get(e,t,n,"json")},getScript:function(e,t){return w.get(e,void 0,t,"script")}}),w.each(["get","post"],function(e,t){w[t]=function(e,n,r,i){return g(n)&&(i=i||r,r=n,n=void 0),w.ajax(w.extend({url:e,type:t,dataType:i,data:n,success:r},w.isPlainObject(e)&&e))}}),w._evalUrl=function(e){return w.ajax({url:e,type:"GET",dataType:"script",cache:!0,async:!1,global:!1,"throws":!0})},w.fn.extend({wrapAll:function(e){var t;return this[0]&&(g(e)&&(e=e.call(this[0])),t=w(e,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstElementChild)e=e.firstElementChild;return e}).append(this)),this},wrapInner:function(e){return g(e)?this.each(function(t){w(this).wrapInner(e.call(this,t))}):this.each(function(){var t=w(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=g(e);return this.each(function(n){w(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(e){return this.parent(e).not("body").each(function(){w(this).replaceWith(this.childNodes)}),this}}),w.expr.pseudos.hidden=function(e){return!w.expr.pseudos.visible(e)},w.expr.pseudos.visible=function(e){return!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)},w.ajaxSettings.xhr=function(){try{return new e.XMLHttpRequest}catch(e){}};var Vt={0:200,1223:204},Gt=w.ajaxSettings.xhr();h.cors=!!Gt&&"withCredentials"in Gt,h.ajax=Gt=!!Gt,w.ajaxTransport(function(t){var n,r;if(h.cors||Gt&&!t.crossDomain)return{send:function(i,o){var a,s=t.xhr();if(s.open(t.type,t.url,t.async,t.username,t.password),t.xhrFields)for(a in t.xhrFields)s[a]=t.xhrFields[a];t.mimeType&&s.overrideMimeType&&s.overrideMimeType(t.mimeType),t.crossDomain||i["X-Requested-With"]||(i["X-Requested-With"]="XMLHttpRequest");for(a in i)s.setRequestHeader(a,i[a]);n=function(e){return function(){n&&(n=r=s.onload=s.onerror=s.onabort=s.ontimeout=s.onreadystatechange=null,"abort"===e?s.abort():"error"===e?"number"!=typeof s.status?o(0,"error"):o(s.status,s.statusText):o(Vt[s.status]||s.status,s.statusText,"text"!==(s.responseType||"text")||"string"!=typeof s.responseText?{binary:s.response}:{text:s.responseText},s.getAllResponseHeaders()))}},s.onload=n(),r=s.onerror=s.ontimeout=n("error"),void 0!==s.onabort?s.onabort=r:s.onreadystatechange=function(){4===s.readyState&&e.setTimeout(function(){n&&r()})},n=n("abort");try{s.send(t.hasContent&&t.data||null)}catch(e){if(n)throw e}},abort:function(){n&&n()}}}),w.ajaxPrefilter(function(e){e.crossDomain&&(e.contents.script=!1)}),w.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/\b(?:java|ecma)script\b/},converters:{"text script":function(e){return w.globalEval(e),e}}}),w.ajaxPrefilter("script",function(e){void 0===e.cache&&(e.cache=!1),e.crossDomain&&(e.type="GET")}),w.ajaxTransport("script",function(e){if(e.crossDomain){var t,n;return{send:function(i,o){t=w("<script>").prop({charset:e.scriptCharset,src:e.url}).on("load error",n=function(e){t.remove(),n=null,e&&o("error"===e.type?404:200,e.type)}),r.head.appendChild(t[0])},abort:function(){n&&n()}}}});var Yt=[],Qt=/(=)\?(?=&|$)|\?\?/;w.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Yt.pop()||w.expando+"_"+Et++;return this[e]=!0,e}}),w.ajaxPrefilter("json jsonp",function(t,n,r){var i,o,a,s=!1!==t.jsonp&&(Qt.test(t.url)?"url":"string"==typeof t.data&&0===(t.contentType||"").indexOf("application/x-www-form-urlencoded")&&Qt.test(t.data)&&"data");if(s||"jsonp"===t.dataTypes[0])return i=t.jsonpCallback=g(t.jsonpCallback)?t.jsonpCallback():t.jsonpCallback,s?t[s]=t[s].replace(Qt,"$1"+i):!1!==t.jsonp&&(t.url+=(kt.test(t.url)?"&":"?")+t.jsonp+"="+i),t.converters["script json"]=function(){return a||w.error(i+" was not called"),a[0]},t.dataTypes[0]="json",o=e[i],e[i]=function(){a=arguments},r.always(function(){void 0===o?w(e).removeProp(i):e[i]=o,t[i]&&(t.jsonpCallback=n.jsonpCallback,Yt.push(i)),a&&g(o)&&o(a[0]),a=o=void 0}),"script"}),h.createHTMLDocument=function(){var e=r.implementation.createHTMLDocument("").body;return e.innerHTML="<form></form><form></form>",2===e.childNodes.length}(),w.parseHTML=function(e,t,n){if("string"!=typeof e)return[];"boolean"==typeof t&&(n=t,t=!1);var i,o,a;return t||(h.createHTMLDocument?((i=(t=r.implementation.createHTMLDocument("")).createElement("base")).href=r.location.href,t.head.appendChild(i)):t=r),o=A.exec(e),a=!n&&[],o?[t.createElement(o[1])]:(o=xe([e],t,a),a&&a.length&&w(a).remove(),w.merge([],o.childNodes))},w.fn.load=function(e,t,n){var r,i,o,a=this,s=e.indexOf(" ");return s>-1&&(r=vt(e.slice(s)),e=e.slice(0,s)),g(t)?(n=t,t=void 0):t&&"object"==typeof t&&(i="POST"),a.length>0&&w.ajax({url:e,type:i||"GET",dataType:"html",data:t}).done(function(e){o=arguments,a.html(r?w("<div>").append(w.parseHTML(e)).find(r):e)}).always(n&&function(e,t){a.each(function(){n.apply(this,o||[e.responseText,t,e])})}),this},w.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){w.fn[t]=function(e){return this.on(t,e)}}),w.expr.pseudos.animated=function(e){return w.grep(w.timers,function(t){return e===t.elem}).length},w.offset={setOffset:function(e,t,n){var r,i,o,a,s,u,l,c=w.css(e,"position"),f=w(e),p={};"static"===c&&(e.style.position="relative"),s=f.offset(),o=w.css(e,"top"),u=w.css(e,"left"),(l=("absolute"===c||"fixed"===c)&&(o+u).indexOf("auto")>-1)?(a=(r=f.position()).top,i=r.left):(a=parseFloat(o)||0,i=parseFloat(u)||0),g(t)&&(t=t.call(e,n,w.extend({},s))),null!=t.top&&(p.top=t.top-s.top+a),null!=t.left&&(p.left=t.left-s.left+i),"using"in t?t.using.call(e,p):f.css(p)}},w.fn.extend({offset:function(e){if(arguments.length)return void 0===e?this:this.each(function(t){w.offset.setOffset(this,e,t)});var t,n,r=this[0];if(r)return r.getClientRects().length?(t=r.getBoundingClientRect(),n=r.ownerDocument.defaultView,{top:t.top+n.pageYOffset,left:t.left+n.pageXOffset}):{top:0,left:0}},position:function(){if(this[0]){var e,t,n,r=this[0],i={top:0,left:0};if("fixed"===w.css(r,"position"))t=r.getBoundingClientRect();else{t=this.offset(),n=r.ownerDocument,e=r.offsetParent||n.documentElement;while(e&&(e===n.body||e===n.documentElement)&&"static"===w.css(e,"position"))e=e.parentNode;e&&e!==r&&1===e.nodeType&&((i=w(e).offset()).top+=w.css(e,"borderTopWidth",!0),i.left+=w.css(e,"borderLeftWidth",!0))}return{top:t.top-i.top-w.css(r,"marginTop",!0),left:t.left-i.left-w.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent;while(e&&"static"===w.css(e,"position"))e=e.offsetParent;return e||be})}}),w.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,t){var n="pageYOffset"===t;w.fn[e]=function(r){return z(this,function(e,r,i){var o;if(y(e)?o=e:9===e.nodeType&&(o=e.defaultView),void 0===i)return o?o[t]:e[r];o?o.scrollTo(n?o.pageXOffset:i,n?i:o.pageYOffset):e[r]=i},e,r,arguments.length)}}),w.each(["top","left"],function(e,t){w.cssHooks[t]=_e(h.pixelPosition,function(e,n){if(n)return n=Fe(e,t),We.test(n)?w(e).position()[t]+"px":n})}),w.each({Height:"height",Width:"width"},function(e,t){w.each({padding:"inner"+e,content:t,"":"outer"+e},function(n,r){w.fn[r]=function(i,o){var a=arguments.length&&(n||"boolean"!=typeof i),s=n||(!0===i||!0===o?"margin":"border");return z(this,function(t,n,i){var o;return y(t)?0===r.indexOf("outer")?t["inner"+e]:t.document.documentElement["client"+e]:9===t.nodeType?(o=t.documentElement,Math.max(t.body["scroll"+e],o["scroll"+e],t.body["offset"+e],o["offset"+e],o["client"+e])):void 0===i?w.css(t,n,s):w.style(t,n,i,s)},t,a?i:void 0,a)}})}),w.each("blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(" "),function(e,t){w.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),w.fn.extend({hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)}}),w.fn.extend({bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)}}),w.proxy=function(e,t){var n,r,i;if("string"==typeof t&&(n=e[t],t=e,e=n),g(e))return r=o.call(arguments,2),i=function(){return e.apply(t||this,r.concat(o.call(arguments)))},i.guid=e.guid=e.guid||w.guid++,i},w.holdReady=function(e){e?w.readyWait++:w.ready(!0)},w.isArray=Array.isArray,w.parseJSON=JSON.parse,w.nodeName=N,w.isFunction=g,w.isWindow=y,w.camelCase=G,w.type=x,w.now=Date.now,w.isNumeric=function(e){var t=w.type(e);return("number"===t||"string"===t)&&!isNaN(e-parseFloat(e))},"function"==typeof define&&define.amd&&define("jquery",[],function(){return w});var Jt=e.jQuery,Kt=e.$;return w.noConflict=function(t){return e.$===w&&(e.$=Kt),t&&e.jQuery===w&&(e.jQuery=Jt),w},t||(e.jQuery=e.$=w),w});

!function(n){"use strict";function t(n,t){var r=(65535&n)+(65535&t);return(n>>16)+(t>>16)+(r>>16)<<16|65535&r}function r(n,t){return n<<t|n>>>32-t}function e(n,e,o,u,c,f){return t(r(t(t(e,n),t(u,f)),c),o)}function o(n,t,r,o,u,c,f){return e(t&r|~t&o,n,t,u,c,f)}function u(n,t,r,o,u,c,f){return e(t&o|r&~o,n,t,u,c,f)}function c(n,t,r,o,u,c,f){return e(t^r^o,n,t,u,c,f)}function f(n,t,r,o,u,c,f){return e(r^(t|~o),n,t,u,c,f)}function i(n,r){n[r>>5]|=128<<r%32,n[14+(r+64>>>9<<4)]=r;var e,i,a,d,h,l=1732584193,g=-271733879,v=-1732584194,m=271733878;for(e=0;e<n.length;e+=16)i=l,a=g,d=v,h=m,g=f(g=f(g=f(g=f(g=c(g=c(g=c(g=c(g=u(g=u(g=u(g=u(g=o(g=o(g=o(g=o(g,v=o(v,m=o(m,l=o(l,g,v,m,n[e],7,-680876936),g,v,n[e+1],12,-389564586),l,g,n[e+2],17,606105819),m,l,n[e+3],22,-1044525330),v=o(v,m=o(m,l=o(l,g,v,m,n[e+4],7,-176418897),g,v,n[e+5],12,1200080426),l,g,n[e+6],17,-1473231341),m,l,n[e+7],22,-45705983),v=o(v,m=o(m,l=o(l,g,v,m,n[e+8],7,1770035416),g,v,n[e+9],12,-1958414417),l,g,n[e+10],17,-42063),m,l,n[e+11],22,-1990404162),v=o(v,m=o(m,l=o(l,g,v,m,n[e+12],7,1804603682),g,v,n[e+13],12,-40341101),l,g,n[e+14],17,-1502002290),m,l,n[e+15],22,1236535329),v=u(v,m=u(m,l=u(l,g,v,m,n[e+1],5,-165796510),g,v,n[e+6],9,-1069501632),l,g,n[e+11],14,643717713),m,l,n[e],20,-373897302),v=u(v,m=u(m,l=u(l,g,v,m,n[e+5],5,-701558691),g,v,n[e+10],9,38016083),l,g,n[e+15],14,-660478335),m,l,n[e+4],20,-405537848),v=u(v,m=u(m,l=u(l,g,v,m,n[e+9],5,568446438),g,v,n[e+14],9,-1019803690),l,g,n[e+3],14,-187363961),m,l,n[e+8],20,1163531501),v=u(v,m=u(m,l=u(l,g,v,m,n[e+13],5,-1444681467),g,v,n[e+2],9,-51403784),l,g,n[e+7],14,1735328473),m,l,n[e+12],20,-1926607734),v=c(v,m=c(m,l=c(l,g,v,m,n[e+5],4,-378558),g,v,n[e+8],11,-2022574463),l,g,n[e+11],16,1839030562),m,l,n[e+14],23,-35309556),v=c(v,m=c(m,l=c(l,g,v,m,n[e+1],4,-1530992060),g,v,n[e+4],11,1272893353),l,g,n[e+7],16,-155497632),m,l,n[e+10],23,-1094730640),v=c(v,m=c(m,l=c(l,g,v,m,n[e+13],4,681279174),g,v,n[e],11,-358537222),l,g,n[e+3],16,-722521979),m,l,n[e+6],23,76029189),v=c(v,m=c(m,l=c(l,g,v,m,n[e+9],4,-640364487),g,v,n[e+12],11,-421815835),l,g,n[e+15],16,530742520),m,l,n[e+2],23,-995338651),v=f(v,m=f(m,l=f(l,g,v,m,n[e],6,-198630844),g,v,n[e+7],10,1126891415),l,g,n[e+14],15,-1416354905),m,l,n[e+5],21,-57434055),v=f(v,m=f(m,l=f(l,g,v,m,n[e+12],6,1700485571),g,v,n[e+3],10,-1894986606),l,g,n[e+10],15,-1051523),m,l,n[e+1],21,-2054922799),v=f(v,m=f(m,l=f(l,g,v,m,n[e+8],6,1873313359),g,v,n[e+15],10,-30611744),l,g,n[e+6],15,-1560198380),m,l,n[e+13],21,1309151649),v=f(v,m=f(m,l=f(l,g,v,m,n[e+4],6,-145523070),g,v,n[e+11],10,-1120210379),l,g,n[e+2],15,718787259),m,l,n[e+9],21,-343485551),l=t(l,i),g=t(g,a),v=t(v,d),m=t(m,h);return[l,g,v,m]}function a(n){var t,r="",e=32*n.length;for(t=0;t<e;t+=8)r+=String.fromCharCode(n[t>>5]>>>t%32&255);return r}function d(n){var t,r=[];for(r[(n.length>>2)-1]=void 0,t=0;t<r.length;t+=1)r[t]=0;var e=8*n.length;for(t=0;t<e;t+=8)r[t>>5]|=(255&n.charCodeAt(t/8))<<t%32;return r}function h(n){return a(i(d(n),8*n.length))}function l(n,t){var r,e,o=d(n),u=[],c=[];for(u[15]=c[15]=void 0,o.length>16&&(o=i(o,8*n.length)),r=0;r<16;r+=1)u[r]=909522486^o[r],c[r]=1549556828^o[r];return e=i(u.concat(d(t)),512+8*t.length),a(i(c.concat(e),640))}function g(n){var t,r,e="";for(r=0;r<n.length;r+=1)t=n.charCodeAt(r),e+="0123456789abcdef".charAt(t>>>4&15)+"0123456789abcdef".charAt(15&t);return e}function v(n){return unescape(encodeURIComponent(n))}function m(n){return h(v(n))}function p(n){return g(m(n))}function s(n,t){return l(v(n),v(t))}function C(n,t){return g(s(n,t))}function A(n,t,r){return t?r?s(t,n):C(t,n):r?m(n):p(n)}"function"==typeof define&&define.amd?define(function(){return A}):"object"==typeof module&&module.exports?module.exports=A:n.md5=A}(this);
//# sourceMappingURL=md5.min.js.map


const base = 'https://www.instagram.com/';
const phoneUA = 'Instagram 27.0.0.7.97 (iPhone7,2; iPhone OS 9_3_3; en_US; en-US; ' +
  'scale=2.00; 750x1334) AppleWebKit/420+';
const loadedPosts = {};
const profiles = {};
let fbDtsg = '';
let isWinReady = false;
let needOpenWindow = false;
let rhx_gis = '';
let toExport = null;
let uid = '';
let win = null;

var log = function(s) {
  try {
    console.log(s);
  } catch(e) {
    GM_log(s);
  }
};
function openWindow() {
  win = window.open(location.href);
  win.addEventListener('readystatechange', () => {
    if (win.document.readyState === 'interactive') {
      isWinReady = true;
      win.document.open();
      win.document.write(`<html><body>
        Loading... <a id="link" href="javascript:;">Return to Parent</a><script>
        (function() {
          const link = document.querySelector('#link');
          link.addEventListener('click', () => {
            const goBack = window.open('', 'main');
            goBack.focus();
          });
        })();
        </script></body></html>`);
      win.document.close();
      if (toExport) {
        sendRequest({ type:'export', data: toExport });
        toExport = null;
      }
    }
  }, true);
}
function request(url, opt = {}) {
  return new Promise((resolve, reject) => {
    Object.assign(opt, {
      headers: {
        'user-agent': phoneUA,
      },
      method: 'GET',
      url,
      timeout: 2000,
      responseType: 'json'
    });
    opt.onerror = opt.ontimeout = reject
    opt.onload = resolve
    GM_xmlhttpRequest(opt);
  });
}

var dFAinit = function(){
  var href = location.href;
  var site = href.match(/(facebook|instagram|twitter|weibo)\.com|ask\.fm|pinterest/);
  if (document.querySelector('#dFA') || !site) {
    return;
  }
  var k, k2, klass;
  if (site[0] == 'instagram.com') {
    klass = qS('header section div span button, header section div button')
    if (!klass) {
      if (location.href.indexOf('/p') > 0) {
        runLater();
      }
      return;
    }
    klass = klass.parentNode;
    k = document.createElement('div');
    k.className = klass ? klass.className : '';
  } else {
    k = document.createElement('li');
  }
  k2 = k.cloneNode();
  k.innerHTML = '<a id="dFA" class="navSubmenu">DownAlbum</a>';
  k2.innerHTML = '<a id="dFAsetup" class="navSubmenu">DownAlbum(Setup)</a>';
  var t = qS('.uiContextualLayerPositionerFixed ul') || qS('.Dropdown ul') ||
    qS('.gn_topmenulist.gn_topmenulist_set ul') || qS('.uiContextualLayer [role="menu"]') ||
    qS('header section div') /* ig */ || qS('[role="menu"]') /* twitter */;
  if(t){
    t.appendChild(k); t.appendChild(k2);
    k.addEventListener("click", function(){
      dFAcore();
    });
    k2.addEventListener("click", function(){
      dFAcore(true);
    });
  }
  if(href.indexOf('facebook.com') > 0){
    if (t) {
      var pBtn = document.createElement('li');
      pBtn.innerHTML = '<a id="photosOf" class="navSubmenu">[FB] Open "Photos of"</a>';
      t.appendChild(pBtn);
      pBtn.addEventListener('click', photosOfHelper);
    }
    if(!t && qS('#userNavigation, #logoutMenu')){
      // Handle async menu
      $('#pageLoginAnchor, #logoutMenu').on('click.dfainit', function(){
        setTimeout(dFAinit, 500);
      });
    }
  }else if(href.indexOf('pinterest') > 0){
    if(!qS('#dfaButton')){
      let search = qS('.SearchPage') ? qS('.SearchPage .gridCentered') : null;
      t = qS('.boardHeaderWrapper') || search || (qS('h1') ? qS('h1').parentNode : null);
      if (!t) {
        return;
      }
      t.innerHTML = '<button id="dfaButton">DownAlbum</button>' +
        '<button id="dfaSetButton">DownAlbum(Setup)</button>' + t.innerHTML;
      qS('#dfaButton').addEventListener("click", function(){
        dFAcore();
      });
      qS('#dfaSetButton').addEventListener("click", function(){
        dFAcore(true);
      });
    }
  }else if(href.indexOf('ask.fm') > 0){
    k = qS('.profileButton').parentNode;
    if (k) {
      k.innerHTML += '<a class="link-green" onClick="dFAcore();">DownAlbum</a>' + 
        '<a class="link-green" onClick="dFAcore(true);">DownAlbum(Setup)</a>';
    } else {
      setTimeout(dFAinit, 300);
    }
  }
  if (location.host.match(/instagram.com|facebook.com|twitter.com/)) {
    var o = window.WebKitMutationObserver || window.MutationObserver;
    if (o && !window.addedObserver) {
      window.addedObserver = true;
      var observer = new o(runLater);
      observer.observe(document.body, {subtree: true, childList: true});
      runLater();
    }
  }
};
function runLater() {
  clearTimeout(window.addLinkTimer);
  window.addLinkTimer = setTimeout(addLink, 300);
}
function addLink() {
  if (location.href.indexOf('instagram.com/p') === -1) {
    dFAinit();
  }
  if (location.host.match(/instagram.com/)) {
    if (location.href.indexOf('explore/') > 0) {
      return;
    }
    let k = qSA('article>div:nth-of-type(1), header>div:nth-of-type(1):not([role="button"])');
    for(var i = 0; i<k.length; i++){
      if (k[i].nextElementSibling) {
        _addLink(k[i], k[i].nextElementSibling);
      }
    }
  } else if (location.host.match(/facebook.com/)) {
    addVideoLink();
  }
}

async function _addLink(k, target) {
  var isProfile = (k.tagName == 'HEADER' || k.parentNode.tagName == 'HEADER');
  let username = null;
  if (isProfile) {
    const u = k.parentNode.querySelector('h1, h2, [title]:not(button)');
    if (u) {
      if (u.parentNode.className === 'dLink') {
        return;
      }
      username = u.textContent;
    }
  }
  var tParent = target.parentNode;
  var t = k.querySelector('img, video');
  if (t) {
    var src = t.getAttribute('src');
    if (!src) {
      return setTimeout(addLink, 300);
    }
    src = isProfile && profiles[username] ? profiles[username].src : parseFbSrc(src);
    if (qS('.dLink [href="' + src + '"]')) {
      return;
    }
    var next = isProfile ? target.querySelector('.dLink') :
      target.nextElementSibling;
    if (next) {
      if (next.childNodes[0] &&
        next.childNodes[0].getAttribute('href') == src) {
        return;
      } else {
        (isProfile ? target : tParent).removeChild(next);
      }
    }
  }
  if (isProfile) {
    if (profiles[username] === null) {
      return;
    } else if (profiles[username] === undefined) {
      profiles[username] = null;
      try {
        let r = await fetch(`https://www.instagram.com/${username}/?__a=1`);
        const id = (await r.json()).graphql.user.id;
        r = await request(`https://i.instagram.com/api/v1/users/${id}/info/`);
        profiles[username] = {
          id,
          src: r.response.user.hd_profile_pic_url_info.url
        };
        src = profiles[username].src;
      } catch (e) {
        console.error(e);
        profiles[username] = null;
      }
    }
    if (!profiles[username]) {
      return;
    }
    const { id } = profiles[username];
    if (!k.querySelector(`.dStory[data-id="${id}"]`)) {
      const storyBtn = document.createElement('a');
      storyBtn.className = 'dStory';
      storyBtn.style.cssText = 'max-width: 200px; cursor: pointer;';
      storyBtn.dataset.id = id;
      storyBtn.textContent = 'Download Stories';
      k.appendChild(storyBtn);
      storyBtn.addEventListener('click', () => loadStories(id));
      const highlightBtn = document.createElement('a');
      highlightBtn.style.cssText = 'max-width: 200px; cursor: pointer;';
      highlightBtn.textContent = 'Download Highlights';
      k.appendChild(highlightBtn);
      highlightBtn.addEventListener('click', () => loadHighlights(id));
    }
  }
  const container = getParent(k, 'article') || k;
  const albumBtn = container.querySelector('.coreSpriteRightChevron');
  if (t && src) {
    const link = document.createElement('div');
    link.className = 'dLink';
    link.style.maxWidth = '200px';
    const items = [];
    if (albumBtn || t.getAttribute('poster')) {
      const url = container.querySelector('a time').parentNode.getAttribute('href');
      if (loadedPosts[url] !== undefined) {
        if (loadedPosts[url] === 1) {
          return;
        }
        loadedPosts[url].forEach(img => items.push(img));
      } else {
        loadedPosts[url] = 1;
        let r = await fetch(`${url}?__a=1`, { credentials: 'include' });
        r = await r.json();
        loadedPosts[url] = [];
        const m = r.graphql.shortcode_media;
        (albumBtn ? m.edge_sidecar_to_children.edges : [{ node: m }]).forEach((e, i) => {
          const { dash_info, id, is_video, video_url, display_url } = e.node;
          const dash = is_video && dash_info.is_dash_eligible ?
            `${id}.mpd,${URL.createObjectURL(new Blob([dash_info.video_dash_manifest]))}|` : '';
          const img = `${dash}${is_video ? `${video_url}|` : ''}${parseFbSrc(display_url)}`;
          loadedPosts[url].push(img);
          items.push(img);
        });
      }
    } else {
      if (src.match('mp4')) {
        src += `|${t.getAttribute('poster')}`;
      }
      items.push(src);
    }
    let html = '';
    items.forEach((e, i) => {
      const s = e.split('|');
      const idx = items.length > 1 ? `#${i + 1} `: '';
      if (s.length > 2) {
        const [name, url] = s.shift().split(',');
        html += `<a href="${url}" download="${name}" target="_blank"\
        >Download ${idx}Video (Dash)</a>`;
      }
      html += s.length > 1 ? `<a href="${s.shift()}" target="_blank"\
        >Download ${idx}Video</a>` : '';
      html += `<a href="${s.shift()}" target="_blank">Download ${idx}Photo</a>`;
    });
    link.innerHTML = html;
    if (isProfile) {
      k.appendChild(link);
    } else if (target.insertAdjacentElement) {
      target.insertAdjacentElement('afterEnd', link);
    } else {
      if (target.nextSibling) {
        tParent.insertBefore(link, target.nextSibling);
      } else {
        tParent.appendChild(link);
      }
    }
  }
}
async function loadStories(id, highlightId = '') {
  const hash = '61e453c4b7d667c6294e71c57afa6e63';
  const variables = `{"reel_ids":["${id}"],"tag_names":[],` +
      `"location_ids":[],"highlight_reel_ids":[${highlightId}],`+
      `"precomposed_overlay":false,"show_story_header_follow_button":false}`;
  try {
    const url = `${base}graphql/query/?query_hash=${hash}&variables=${variables}`;
    let r = await fetch(url, { credentials: 'include' });
    r = await r.json();
    if (!r.data.reels_media || !r.data.reels_media.length) {
      alert('No stories loaded');
      return;
    }
    openWindow();
    const type = highlightId !== '' ? 'GraphHighlightReel' : 'GraphReel';
    const { items, latest_reel_media: last, owner, user } =
      r.data.reels_media.filter(e => e.__typename === type)[0];
    const lastTime = last ? last : items[0].taken_at_timestamp;
    const photodata = {
      aDes: '',
      aName: 'Stories',
      aAuth: (user || owner).username,
      aLink: `${base}${(user || owner).username}`,
      aTime: lastTime ? 'Last Update: ' + parseTime(lastTime) : '',
      newL: true,
      newLayout: true,
      photos: [],
      videos: [],
      type: 'Stories',
    };
    items.forEach((e, i) => {
      const p = { url: e.display_url, href: '',
        date: parseTime(e.taken_at_timestamp) };
      if (e.video_resources) {
        p.videoIdx = photodata.videos.length;
        const { src } = e.video_resources[e.video_resources.length - 1];
        photodata.videos.push({ url: src, thumb: e.display_url });
      }
      photodata.photos.push(p);
    });
    if (isWinReady) {
      sendRequest({ type:'export', data: photodata });
    } else {
      toExport = photodata;
    }
  } catch (e) {
    console.error(e);
    alert('Cannot load stories');
  }
}
async function loadHighlights(id) {
  const hash = 'ad99dd9d3646cc3c0dda65debcd266a7';
  const variables = `{"user_id":"${id}","include_highlight_reels":true}`;
  try {
    const url = `${base}graphql/query/?query_hash=${hash}&variables=${variables}`;
    let r = await fetch(url, { credentials: 'include' });
    r = await r.json();
    const list = r.data.user.edge_highlight_reels.edges;
    if (!list || !list.length) {
      alert('No highlights loaded');
      return;
    }
    createDialog();
    g.statusEle = qS('.daCounter');
    g.statusEle.innerHTML = '<p>Select highlight to download:</p>'
    for (let i = 0; i < list.length; i++) {
      const n = list[i].node;
      const a = document.createElement('a');
      g.statusEle.appendChild(a);
      a.style.cssText = 'width: 100px; display: inline-block;';
      a.innerHTML = `<img src="${n.cover_media_cropped_thumbnail.url}" ` +
        `style="width:100%;" /><br>${n.title}`;
      a.addEventListener('click', () => loadStories(id, `"${n.id}"`));
    }
  } catch (e) {
    console.error(e);
    alert('Cannot load highlights');
  }
}
function getFbEnv() {
  const s = qSA('script');
  for (let i = 0; i < s.length; i += 1) {
    let t = s[i].textContent;
    if (t) {
      const m = t.match(/"USER_ID":"(\d+)"/);
      if (m) {
        uid = m[1];
      }
      if (t.indexOf('DTSGInitialData') > 0) {
        t = t.slice(t.indexOf('DTSGInitialData'));
        t = t.slice(0, t.indexOf('}')).split('"');
        fbDtsg = t[4];
      }
    }
  }
}
async function addVideoLink() {
  if (window.location.href.indexOf('/videos/') === -1) {
    return;
  }
  let id = window.location.href.match(/\/\d+\//g);
  if (!id) {
    return;
  }
  id = id[id.length - 1].slice(1, -1);
  if (!loadedPosts[id]) {
    loadedPosts[id] = 1;
    getFbEnv();
    const url = `https://www.facebook.com/video/tahoe/async/${id}/?chain=true&payloadtype=primary`;
    const options = {
      credentials: 'include',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `__user=${uid}&__a=1&fb_dtsg=${fbDtsg}`,
    };
    let r = await fetch(url, options);
    r = await r.text();
    r = JSON.parse(r.slice(9)).jsmods.instances;
    for (let idx = 0; idx < r.length; idx += 1) {
      const i = r[idx];
      if (i[1] && i[1].length && i[1][0] === 'VideoConfig') {
        const data = i[2][0].videoData[0];
        const src = data.hd_src_no_ratelimit || data.hd_src ||
          data.sd_src_no_ratelimit || data.sd_src;
        loadedPosts[id] = src;
      }
    }
  } else if (loadedPosts[id] === 1) {
    return;
  }
  const e = qSA('[data-utime]:not(.livetimestamp), .timestamp');
  for (let i = 0; i < e.length; i += 1) {
    if (!e[i].parentNode.querySelector('.dVideo')) {
      const a = document.createElement('a');
      a.className = 'dVideo';
      a.href = loadedPosts[id];
      a.download = '';
      a.target = '_blank';
      a.style.padding = '5px';
      a.title = '(provided by DownAlbum)';
      a.textContent = 'Download ↓';
      e[i].parentNode.appendChild(a);
    }
  }
}
function photosOfHelper() {
  var userId;
  var timeline = qS('#pagelet_timeline_main_column');
  try {
    if (timeline) {
      userId = JSON.parse(timeline.getAttribute('data-gt')).profile_owner;
    }
  } catch(e) {}

  var cover = qS('.coverWrap') || qS('.coverImage');
  try {
    if (cover && !userId) {
      userId = cover.href.match(/set=([\w\d\.]+)/)[1].split('.')[3];
    }
  } catch(e) {}

  if (userId) {
    location.href = '/search/' + userId + '/photos-of/intersect';
  }
}
var g = {};
function getParent(child, selector){
  var target = child;
  while(target && !target.querySelector(selector)){
    if (target.parentNode && target.parentNode.tagName == 'BODY') {
      return target;
    }
    if (target.parentNode && target.parentNode.querySelector(selector)) {
      return target;
    } else {
      target = target.parentNode;
    }
  }
  return null;
}
function getText(s, html, parent){
  var q = parent ? parent.querySelector(s) : qS(s);
  var t = 'textContent';
  if(q && q.querySelectorAll('br').length){t = 'innerHTML';}
  if(q && html && q.querySelectorAll('a').length){t = 'innerHTML';}
  return q ? q[t] : "";
}
function getDOM(html){
  var doc;
  if(document.implementation){
    doc = document.implementation.createHTMLDocument('');
    doc.documentElement.innerHTML = html;
  }else if(DOMParser){
    doc = (new DOMParser).parseFromString(html, 'text/html');
  }else{
    doc = document.createElement('div');
    doc.innerHTML = html;
  }
  return doc;
}
function quickSelect(s){
  var method = false;
  switch(s){
    case /#\w+$/.test(s):
      method = 'getElementById'; break;
    case /\.\w+$/.test(s):
      method = 'getElementsByClassName'; break;
  }
  return method;
}
function qS(s){var k = document[quickSelect(s) || 'querySelector'](s);return k&&k.length ? k[0] : k;}
function qSA(s){return document[quickSelect(s) || 'querySelectorAll'](s);}
function padZero(str, len) {
  str = str.toString();
  while (str.length < len) {
    str = '0' + str;
  }
  return str;
}
function parseTime(t, isDate){
  var d = isDate ? t : new Date(t * 1000);
  return d.getFullYear() + '-' + padZero(d.getMonth() + 1, 2) + '-' +
    padZero(d.getDate(), 2) + ' ' + padZero(d.getHours(), 2) + ':' +
    padZero(d.getMinutes(), 2) + ':' + padZero(d.getSeconds(), 2);
}
function parseQuery(s){
  var data = {};
  var n = s.split("&");
  for(var i=0; i<n.length; i++){
    var t = n[i].split("=");
    data[t[0]] = t[1];
  }
  return data;
}
function parseFbSrc(s, fb) {
  if (fb) {
    return s.replace(/s\d{3,4}x\d{3,4}\//g, '');
  } else if (!s.match(/\/fr\/|_a\.jpg|1080x/)) {
    return s.replace(/c\d+\.\d+\.\d+\.\d+\//, '')
      .replace(/\w\d{3,4}x\d{3,4}\//g, s.match(/\/e\d{2}\//) ? '' : 'e15/');
  }
  return s;
}
function parsePos(n) {
  return +((n * 100).toFixed(3));
}
function getFbid(s){
  if (!s || !s.length) {
    return false;
  }
  var fbid = s.match(/fbid=(\d+)/);
  if(!fbid){
    if(s.match('opaqueCursor')){
      var index = s.indexOf('/photos/');
      if(index != -1){
        fbid = getFbid(s.slice(index + 8));
        if(fbid){
          return fbid;
        }
      }
      if(!fbid){
        fbid = s.match(/\/([0-9]+)\//);
        if(!fbid){
          fbid = s.match(/([0-9]{5,})/);
        }
      }
    } else if (s.match('&') && !s.match(/photos|videos/)) {
      try{
        fbid = s.slice(s.indexOf('=') + 1, s.indexOf('&'));
      }catch(e){}
      return fbid ? fbid : false;
    } else {
      // id for page's photos / video album
      fbid = s.match(/\/(?:photos|videos)(?:\/[\w\d\.-]+)*\/(\d+)/);
    }
  }
  return fbid && fbid.length ? fbid[1] : false;
}
function getSharedData(response) {
  var html = response;
  var doc = getDOM(html);
  s = doc.querySelectorAll('script');
  for (i=0; i<s.length; i++) {
    if (!s[i].src && s[i].textContent.indexOf('_sharedData') > 0) {
      s = s[i].textContent;
      break;
    }
  }
  return JSON.parse(s.match(/({".*})/)[1]);
}
function extractJSON(str) {
  // http://stackoverflow.com/questions/10574520/
  var firstOpen, firstClose, candidate;
  firstOpen = str.indexOf('{', firstOpen + 1);
  var countOpen = 0, countClose = 0;
  do {
    countOpen++;
    firstClose = str.lastIndexOf('}');
    if (firstClose <= firstOpen) {
      return null;
    }
    countClose = 0;
    do {
      countClose++;
      candidate = str.substring(firstOpen, firstClose + 1);
      var res;
      try {
        res = JSON.parse(candidate);
        return res;
      } catch (e) {}
      try {
        res = eval("(" + candidate + ")");
        return res;
      } catch (e) {}
      firstClose = str.substr(0, firstClose).lastIndexOf('}');
    } while (firstClose > firstOpen && countClose < 20);
    firstOpen = str.indexOf('{', firstOpen + 1);
  } while (firstOpen != -1 && countOpen < 20);
}
function createDialog() {
  if (qS('#daContainer')) {
    qS('#daContainer').style = '';
    qS('#stopAjaxCkb').checked = false;
    return;
  }
  var d = document.createElement('div');
  var s = document.createElement('style');
  s.textContent = '#daContainer {position: fixed; width: 360px; \
    top: 20%; left: 50%; margin-left: -180px; background: #FFF; \
    padding: 1em; border-radius: 0.5em; line-height: 2em; z-index: 9999;\
    box-shadow: 1px 3px 3px 0 rgba(0,0,0,.2),1px 3px 15px 2px rgba(0,0,0,.2);}\
    #daHeader {font-size: 1.5rem; font-weight: 700; background: #FFF; \
    padding: 1rem 0.5rem; color: rgba(0,0,0,.85); \
    border-bottom: 1px solid rgba(34,36,38,.15);} \
    .daCounter {max-height: 300px;overflow-y: auto;} \
    #daContent {font-size: 1.2em; line-height: 1.4; padding: .5rem;} \
    #daContainer a {cursor: pointer;border: 1px solid black;padding: 10px; \
      display: block;} \
    #stopAjaxCkb {display: inline-block; -webkit-appearance: checkbox; \
    width: auto;}';
  document.head.appendChild(s);
  d.id = 'daContainer';
  d.innerHTML = '<div id="daHeader">DownAlbum</div><div id="daContent">' +
    'Status: <span class="daCounter"></span><br>' +
    '<label>Stop <input id="stopAjaxCkb" type="checkbox"></label>' +
    '<div class="daExtra"></div>' +
    '<a class="daOutput">Output</a><a class="daClose">Close</a></div>';
  document.body.appendChild(d);
  qS('.daClose').addEventListener('click', hideDialog);
  qS('.daOutput').addEventListener('click', output);
}
function hideDialog() {
  qS('#daContainer').style = 'display: none;';
}
function closeDialog() {
  document.body.removeChild(qS('#daContainer'));
}
function output(){
  if(location.href.match(/.*facebook.com/)){
    document.title = document.title.match(/(?:.*\|\|)*(.*)/)[1];
  }
  document.title=g.photodata.aName;
  if(g.photodata.photos.length>1000 && !g.largeAlbum){
    if(confirm('Large amount of photos may crash the browser:\nOK->Use Large Album Optimize Cancel->Continue'))g.photodata.largeAlbum = true;
  }
  toExport = g.photodata;
  sendRequest({type:'export',data:g.photodata});
}
function initDataLoaded(fbid) {
  if (g.dataLoaded[fbid] === undefined) {
    g.dataLoaded[fbid] = {};
  }
}
function handleFbAjax(fbid) {
  var d = g.dataLoaded[fbid];
  if (d !== undefined) {
    var photos = g.photodata.photos;
    var i = g.ajaxLoaded;
    if (!photos[i]) {
      return true;
    }
    if (g.urlLoaded[fbid]) {
      photos[i].url = g.urlLoaded[fbid];
      delete g.urlLoaded[fbid];
    }
    if (g.commentsList[fbid]) {
      photos[i].comments = g.commentsList[fbid];
      delete g.commentsList[fbid];
    }
    photos[i].title = d.title;
    photos[i].tag = d.tag;
    photos[i].date = d.date;
    if (d.video) {
      photos[i].videoIdx = g.photodata.videos.length;
      g.photodata.videos.push({
        url: d.video
      });
    }
    delete g.dataLoaded[fbid];
    delete photos[i].ajax;
    if (g.ajaxLoaded + 1 < photos.length) {
      g.ajaxLoaded++;
      g.ajaxRetry = 0;
    }
    return true;
  }
  return false;
}
function handleFbAjaxProfiles(data) {
  var profiles = Object.keys(data.profiles);
  for (var j = 0; j < profiles.length; j++) {
    try {
      var p = data.profiles[profiles[j]];
      g.profilesList[p.id] = {name: p.name, url: p.uri};
    } catch(e) {}
  }
}
function handleFbAjaxComment(data) {
  try {
    var comments = data.comments;
    var commentsList = [data.feedbacktarget.commentcount];
    var fbid = comments[0].ftentidentifier;
    var timeFix = new Date(parseTime(data.servertime)) - new Date();
  } catch(e) {
    console.log('Cannot parse comment');
    return;
  }
  for (j = 0; j < comments.length; j++){
    try {
      var c = comments[j];
      p = g.profilesList[c.author];
      commentsList.push({
        fbid: fbid,
        id: c.legacyid,
        name: p.name,
        url: p.url,
        text: c.body.text,
        date: parseTime(c.timestamp.time)
      });
    } catch(e) {}
  }
  g.commentsList[fbid] = commentsList;
  g.commentsList.count++;
}
function fbAjax(){
  var len=g.photodata.photos.length,i=g.ajaxLoaded;
  var src;
  try{
    src = getFbid(g.photodata.photos[i].href);
  }catch(e){
    if(i + 1 < len){g.ajaxLoaded++; fbAjax();}else{output();}
    return;
  }
  if (handleFbAjax(src)) {
    if(len<50||i%15==0)log('Loaded '+(i+1)+' of '+len+'. (cached)');
    g.statusEle.textContent='Loading '+(i+1)+' of '+len+'.';
    if(i+1!=len){document.title="("+(i+1)+"/"+(len)+") ||"+g.photodata.aName;fbAjax();
    }else{output();}
  }else if(!qS('#stopAjaxCkb')||!qS('#stopAjaxCkb').checked){
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    clearTimeout(g.timeout);
    let r = this.response, targetJS = [], list = [src];
    if (g.isPageVideo) {
      r = JSON.parse(r.slice(9));
      var k = r.jsmods.instances;
      for (var ii = 0; ii < k.length; ii++) {
        if (!k[ii] || !k[ii].length || !k[ii][1] || !k[ii][1].length) {
          continue;
        }
        if (k[ii][1][0] === 'VideoConfig') {
          var inst = k[ii][2][0].videoData[0];
          initDataLoaded(inst.video_id);
          g.dataLoaded[inst.video_id].video = inst.hd_src || inst.sd_src;
        }
      }
      g.cursor = r.payload.cursor;
    } else {
      targetJS = r.split('/*<!-- fetch-stream -->*/');
    }
    for (var k = 0; k < targetJS.length - 1; k++) {
      var t = targetJS[k], content = JSON.parse(t).content;
      if (!content.payload || !content.payload.jsmods || !content.payload.jsmods.require) {
        continue;
      }
      var require=content.payload.jsmods.require;
      if(require&&(content.id=='pagelet_photo_viewer'||require[0][1]=='addPhotoFbids')){list=require[0][3][0];}
      for (var ii = 0; ii < require.length; ii++) {
        if (!require[ii] || !require[ii].length) {
          continue;
        }
        if (require[ii].length > 2 && require[ii][0] == 'UFIController') {
          var inst = require[ii][3];
          if (inst.length && inst[2]) {
            handleFbAjaxProfiles(inst[2]);
          }
        }
      }
      for (var ii = 0; ii < require.length; ii++) {
        if (!require[ii] || !require[ii].length) {
          continue;
        }
        if (require[ii].length > 2 && require[ii][0] == 'UFIController') {
          var inst = require[ii][3];
          if (inst.length && inst[2].comments && inst[2].comments.length) {
            handleFbAjaxComment(inst[2]);
          }
        }
        if (require[ii][1] == 'storeFromData') {
          var image = require[ii][3][0].image;
          if (image) {
            var keys = Object.keys(image);
            for (var j = 0; j < keys.length; j++) {
              var pid = keys[j];
              if (image[pid].url) {
                g.urlLoaded[pid] = image[pid].url;
              }
            }
          }
        }
      }
      if (t.indexOf('fbPhotosPhotoTagboxBase') > 0 ||
        t.indexOf('fbPhotosPhotoCaption') > 0 ||
        t.indexOf('uiContextualLayerParent') > 0) {
        var markup = content.payload.jsmods.markup;
        for (var ii = 0; ii < markup.length; ii++) {
          var test = markup[ii][1].__html;
          var h = document.createElement('div');
          h.innerHTML = unescape(test);
          var box = h.querySelectorAll('.snowliftPayloadRoot');
          if (box.length) {
            for (var kk = 0; kk < box.length; kk++) {
              var c = box[kk].querySelector('.fbPhotosPhotoCaption');
              var b = box[kk].querySelector('.fbPhotosPhotoTagboxes');
              var a = box[kk].querySelector('abbr');
              if (!a) {continue;}

              var s = c.querySelector('.hasCaption');
              s = !s ? '' : s.innerHTML.match(/<br>|<wbr>/) ?
                s.outerHTML.replace(/'/g,'&quot;') : s.textContent;
              var tag = b.querySelector('.tagBox');
              pid = a.parentNode.href.match(/permalink|story_fbid/) ? null :
                getFbid(a.parentNode.href);
              if (!pid) {
                var btn = box[kk].querySelector('.sendButton');
                if (btn) {
                  pid = parseQuery(btn.href).id;
                }
              }
              initDataLoaded(pid);
              g.dataLoaded[pid].tag = !tag ? '' : b.outerHTML;
              g.dataLoaded[pid].title = s;
              g.dataLoaded[pid].date = a ? parseTime(a.dataset.utime) : '';
            }
          }
          // Handle profile / group video cover
          box = h.querySelector('.img');
          if (h.querySelector('video') && box) {
            try {
              var bg = box.style.backgroundImage.slice(5, -2);
              var file = bg.match(/\/(\w+\.jpg)/)[1];
              for (var kk = g.ajaxLoaded; kk < len; kk++) {
                var a = g.photodata.photos[kk];
                if (a.url.indexOf(file) > 0) {
                  a.url = bg;
                  break;
                }
              }
            } catch (e) {}
          }
        }
      }
      // Fallback to old comment
      var instances = content.payload.jsmods.instances;
      for(ii = 0; instances && ii<instances.length; ii++){
        if (!instances[ii] || !instances[ii].length ||
          !instances[ii][1] || !instances[ii][1].length) {
          continue;
        }
        if (instances[ii][1][0] === 'UFIController') {
          inst = instances[ii][2];
          if (inst.length && inst[2].comments && inst[2].comments.length) {
            handleFbAjaxProfiles(inst[2]);
          }
        }
      }
      for(ii = 0; instances && ii<instances.length; ii++){
        if (!instances[ii] || !instances[ii].length ||
          !instances[ii][1] || !instances[ii][1].length) {
          continue;
        }
        if (instances[ii][1][0] === 'UFIController') {
          inst = instances[ii][2];
          if (inst.length && inst[2].comments && inst[2].comments.length) {
            handleFbAjaxComment(inst[2]);
          }
        }
        if (instances[ii][1][0] === 'VideoConfig') {
          inst = instances[ii][2][0].videoData[0];
          initDataLoaded(inst.video_id);
          g.dataLoaded[inst.video_id].video = inst.hd_src || inst.sd_src;
        }
      }
    }
    handleFbAjax(src);
    if(len<50||i%15==0)log('Loaded '+(i+1)+' of '+len+'.');
    g.statusEle.textContent = 'Loaded ' + (i+1) + ' of ' + len;
    if(i+1>=len){
      output();
    }else{
      if (i === g.ajaxLoaded) {
        g.ajaxRetry++;
        if (g.isPageVideo) {
          g.photodata.photos[i].ajax = location.origin +
            '/video/channel/view/story/async/' + src + '/?video_ids[0]=' + src;
        }
      }
      if (g.ajaxRetry > 5) {
        if (g.ajaxAutoNext) {
          g.ajaxRetry = 0;
          g.ajaxLoaded++;
        } else {
          var retryReply = prompt('Retried 5 times.\nTry again->OK\n' +
            'Try next photo->Type 1\nAlways try next->Type 2\n' +
            'Output loaded photos->Cancel');
          if (retryReply !== null) {
            g.ajaxRetry = 0;
            if (+retryReply === 2){
              g.ajaxAutoNext = true;
              g.ajaxLoaded++;
            } else {
              g.ajaxLoaded++;
            }
          } else {
            output();
            return;
          }
        }
      }
      document.title="("+(i+1)+"/"+(len)+") ||"+g.photodata.aName;fbAjax();
    }
  };
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 2 && xhr.status != 200) {
      clearTimeout(g.timeout);
      g.ajaxLoaded++;
      fbAjax();
    }
  };
  g.photodata.photos[i].ajax += `&fb_dtsg_ag=${g.fb_dtsg_ag}`;
  if (g.isPageVideo) {
    xhr.open('POST', g.photodata.photos[i].ajax +
      (g.cursor ? '&cursor=' + g.cursor : ''));
  } else {
    xhr.open('GET', g.photodata.photos[i].ajax);
  }
  g.timeout=setTimeout(function(){
    xhr.abort();
    g.ajaxRetry++;
    if(g.ajaxRetry>5){if(confirm('Timeout reached.\nTry again->OK\nOutput loaded photos->Cancel')){g.ajaxRetry=0;fbAjax();}else{output();}}
  },10000);
  var data = null;
  if (g.isPageVideo) {
    if (!g.fb_dtsg) {
      getFbDtsg();
    }
    data = `__user=${g.Env.user}&__a=1&fb_dtsg=${g.fb_dtsg}&fb_dtsg_ag=${g.fb_dtsg_ag}`;
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  }
  xhr.send(data);}else{output();}
}
function getPhotos(){
  if(g.start!=2||g.start==3){return;}
  var scrollEle = !!(qS('#fbTimelinePhotosScroller *, ' +
    '.uiSimpleScrollingLoadingIndicator, .fbStarGrid~img, ' +
    '.fbStarGridWrapper~img, #browse_result_below_fold, ' +
    '#content_container div > span[aria-busy="true"], ' +
    '#pages_video_hub_all_videos_pagelet .uiMorePagerLoader') ||
    (!qS('#browse_end_of_results_footer') && qS('#content div.hidden_elem')
    && location.href.match('search')));
  if(g.ajaxFailed&&g.mode!=2&&scrollEle){scrollTo(0, document.body.clientHeight);setTimeout(getPhotos,2000);return;}//g.start=3;
  var i, photodata = g.photodata, testNeeded = 0, ajaxNeeded = 0;
  var elms = g.elms || qS('#album_photos_pagelet') || qS('#album_pagelet') ||
    qS('#static_set_pagelet') || qS('#pagelet_photos_stream') ||
    qS('#group_photoset') || qS('#initial_browse_result') ||
    qS('#pagelet_timeline_medley_photos') || qS('#content_container') ||
    qS('#content');
  var grid = qSA('#fbTimelinePhotosFlexgrid, .fbStarGrid, ' +
    '#pages_video_hub_all_videos_pagelet');
  var selector = 'a[rel="theater"]';
  var tmp = [], tmpE, eLen;
  if(g.elms){ajaxNeeded=1;}
  else if(grid.length){
    if(grid.length>1){
      for(eLen = 0; eLen<grid.length; eLen++){
        tmpE = grid[eLen].querySelectorAll(g.thumbSelector);
        for(var tmpLen = 0; tmpLen<tmpE.length; tmpLen++){
          tmp.push(tmpE[tmpLen]);
        }
      }
      elms = tmp; ajaxNeeded=1;
    }else{elms=grid[0].querySelectorAll(g.thumbSelector);ajaxNeeded=1;}
  }else if(elms){
    var temp = elms.querySelectorAll(g.thumbSelector);ajaxNeeded=1;
    if(!temp.length){
      testNeeded = 1;
      tmpE = elms.querySelectorAll(selector);
      for(eLen = 0; eLen < tmpE.length; eLen++){
        if (tmpE[eLen].querySelector('img')) {
          tmp.push(tmpE[eLen]);
        }
      }
      elms = tmp;
    }else{
      elms = temp;
    }
  }
  else{elms=qSA(selector);testNeeded=1;}
  if(qSA('.fbPhotoStarGridElement')){ajaxNeeded=1;}

  if (g.isPage) {
    if (qS('input[type="file"][accept="image/*"]')) {
      g.pageType = 'other';
    } else {
      g.pageType = 'posted';
    }
  }

  if(g.mode!=2&&!g.lastLoaded&&scrollEle&&(!qS('#stopAjaxCkb')||!qS('#stopAjaxCkb').checked)){
    fbAutoLoad(g.isPage && !g.isVideo ? [] : elms);return;
  }
  for (i = 0;i<elms.length;i++) {
    if (testNeeded) {
      var test1 = (getParent(elms[i],'.mainWrapper')&&getParent(elms[i],'.mainWrapper').querySelector('.shareSubtext')&&elms[i].childNodes[0]&&elms[i].childNodes[0].tagName=='IMG');
      var test2 = (getParent(elms[i],'.timelineUnitContainer')&&getParent(elms[i],'.timelineUnitContainer').querySelector('.shareUnit'));
      var test3 = (elms[i].querySelector('img')&&!elms[i].querySelector('img').scrollHeight);
      if (test1 || test2 || test3) {
        continue;
      }
    }
    try{
    var ajaxify = unescape(elms[i].getAttribute('ajaxify')) || '';
    var href = ajaxify.indexOf('fbid=') > -1 ? ajaxify : elms[i].href;
    var isVideo = (href.indexOf('/videos/') > -1 || g.isVideo);
    var parentSrc = elms[i].parentNode ? 
      elms[i].parentNode.getAttribute('data-starred-src') : '';
    var bg = !isVideo ? elms[i].querySelector('img, i') :
      elms[i].querySelector(g.isPage ? 'img' : 'div[style], .uiVideoLinkImg');
    var src = bg ? bg.getAttribute('src') : '';
    if (src) {
      if (src.indexOf('rsrc.php') > 0) {
        src = '';
      } else if (src && src.indexOf('?') === -1) {
        src = parseFbSrc(src);
      }
    }
    bg = bg && bg.style ? (bg.style.backgroundImage || '').slice(5, -2) : '';
    var url = src || parentSrc || bg;
    var ohref = href + '';
    var fbid = getFbid(href);
    if(href.match('opaqueCursor')){
      if(fbid){
        href = location.origin + '/photo.php?fbid=' + fbid;
      }else{
        continue;
      }
    }else if(href.match('&')){
      href=href.slice(0, href.indexOf('&'));
    }
    if(!g.downloaded[fbid]){g.downloaded[fbid]=1;}else{continue;}
    var ajax = '';
    if (!g.notLoadCm && !isVideo) {
      var q = {};
      if (url.indexOf('&src') != -1) {
        ajax = url.slice(url.indexOf("?")+1,url.indexOf("&src")).split("&");
        url = parseFbSrc(url.match(/&src.(.*)/)[1]).replace(/&smallsrc=.*\?/, '?', true);
      } else {
        ajax = ohref.slice(ohref.indexOf('?') + 1).split('&');
        var pset = ohref.match(/\/photos\/([\.\d\w-]+)\//);
        if (pset) {
          q = {set: pset[1]};
        }
      }
      for(var j=0;j<ajax.length;j++){var d=ajax[j].split("=");q[d[0]]=d[1];}
      if(!q.fbid && fbid){
        q.fbid = fbid;
      }
      ajax = location.origin + '/ajax/pagelet/generic.php/' +
        'PhotoViewerInitPagelet?ajaxpipe=1&ajaxpipe_fetch_stream=1&ajaxpipe_token=' +
        g.Env.ajaxpipe_token + '&no_script_path=1&data=' + JSON.stringify(q)+
        '&__user=' + g.Env.user + '&__a=1&__adt=2';
    } else if (!g.notLoadCm && isVideo) {
      if (g.isPage) {
        if (i === 0) {
          ajax = location.origin + '/video/channel/view/story/async/' + fbid +
            '/?video_ids[0]=' + fbid;
        } else {
          ajax = location.origin + '/video/channel/view/async/' + g.pageId +
            '/?story_count=20&original_video_id=' +
            getFbid(photodata.photos[photodata.photos.length - 1].href);
        }
      } else {
        var id = href.match(/\/videos\/([\w+\d\.-]+)\/(\d+)/);
        var q = {
          type: 3,
          v: id[2],
          set: id[1]
        };
        ajax = location.origin + '/ajax/pagelet/generic.php/' +
          'PhotoViewerInitPagelet?ajaxpipe=1&ajaxpipe_fetch_stream=1&ajaxpipe_token=' +
          g.Env.ajaxpipe_token + '&no_script_path=1&data=' + JSON.stringify(q) +
          '&__user=' + g.Env.user + '&__a=1&__adt=2';
      }
    }
    if(url.match(/\?/)){
      var b=url.split('?'), t='', a=b[1].split('&');
      for(var ii=0;ii<a.length;ii++){
        if(a[ii].match(/oh|oe|__gda__/))t+=a[ii]+'&';
      }
      url = b[0] + (t.length?('?'+t.slice(0, -1)):'');
    } else if (url.indexOf('&') > 0) {
      url = url.slice(0, url.indexOf('&'));
    }
    var title = elms[i].getAttribute('title') || (elms[i].querySelector('img') ?
      elms[i].querySelector('img').getAttribute('alt') : '') || '';
    title=title.indexOf(' ')>0?title:'';
    title=title.indexOf(': ')>0||title.indexOf('： ')>0?title.slice(title.indexOf(' ')+1):title;
    if(!title){
    t=getParent(elms[i],'.timelineUnitContainer')||getParent(elms[i],'.mainWrapper');
    if(t){var target1=t.querySelectorAll('.fwb').length>1?'':t.querySelector('.userContent');}
    var target2=elms[i].getAttribute('aria-label')||'';
    if(target2){title=target2;}
    if(title===''&&target1){title=target1.innerHTML.match(/<br>|<wbr>/)?target1.outerHTML.replace(/'/g,'&quot;'):target1.textContent;}
    }
    var newPhoto={url: url, href: href};
    newPhoto.title=title;
    if (elms[i].dataset.date) {
      newPhoto.date = parseTime(elms[i].dataset.date);
    }
    if(!g.notLoadCm)newPhoto.ajax=ajax;
    if (url) {
      photodata.photos.push(newPhoto);
    }
    }catch(e){log(e);}
  }
  if(qS('#stopAjaxCkb')&&qS('#stopAjaxCkb').checked){qS('#stopAjaxCkb').checked=false;}
  log('export '+photodata.photos.length+' photos.');
  if(!g.notLoadCm){
    if (ajaxNeeded && (g.loadCm || confirm("Try to load photo's caption?"))) {
      g.elms = null;
      fbAjax();
    } else {output();}
  }else{output();}
}
function getFbMessagesPhotos() {
  if (!g.threadId) {
    g.ajax = null;
    g.photodata.aName = getText('.fb_content [role="main"] h2');
    if (qS('a[uid]')) {
      g.threadId = qS('a[uid]').getAttribute('uid');
    } else if (location.href.match(/messages\/t\/(\d+)/)) {
      g.threadId = location.href.match(/messages\/t\/(\d+)/)[1];
    } else {
      alert('Cannot get message thread id.');
      return;
    }
  }
  var variables = JSON.stringify({ id: g.threadId, first: 30, after: g.ajax });
  var url = location.origin + '/webgraphql/query/?query_id=515216185516880&variables='+variables;
  var data = '__user='+g.Env.user+'&__a=1&__req=7&fb_dtsg='+g.fb_dtsg;
  var xhr = new XMLHttpRequest();
  xhr.onload = function(){
    var payload = extractJSON(this.response).payload[g.threadId];
    if (!payload.message_shared_media) {
      alert('Cannot get message media.');
      return;
    }
    for (var i = 0; i < payload.message_shared_media.edges.length; i++) {
      var n = payload.message_shared_media.edges[i].node;
      g.photodata.photos.push({ href: '', url: n.image2.uri });
    }
    g.statusEle.textContent = 'Loading album... (' + g.photodata.photos.length + ')';
    if (payload.message_shared_media.page_info.has_next_page) {
      g.ajax = payload.message_shared_media.page_info.end_cursor;
      getFbMessagesPhotos();
    } else if (g.photodata.photos.length) {
      output();
    }
  };
  xhr.open('POST', url);
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.send(data);
}
function getQL(type, target, key) {
  if (g.pageType === 'album') {
    if (!g.elms.length && !g.ajaxStartFrom) {
      return 'Query PhotoAlbumRoute {node(' + g.pageAlbumId +
        ') {id,__typename,@F8}} QueryFragment F0 : Photo {album {' +
        'album_type,id},can_viewer_edit,id,owner {id,__typename}} ' +
        'QueryFragment F1 : Photo {can_viewer_delete,id} QueryFragment F2 : ' +
        'Feedback {does_viewer_like,id} QueryFragment F3 : Photo {id,album {' +
        'id,name},feedback {id,can_viewer_comment,can_viewer_like,likers {' +
        'count},comments {count},@F2}} QueryFragment F4 : Photo {' +
        'can_viewer_edit,id,image as _image1LP0rd {uri},url,modified_time,' +
        'message {text},@F0,@F1,@F3} QueryFragment F5 : Node {id,__typename}' +
        ' QueryFragment F6 : Album {can_upload,id} QueryFragment F7 : Album' +
        ' {id,media.first(28) as ' + key + ' {edges {node {__typename,@F4,' +
        '@F5},cursor},page_info {has_next_page,has_previous_page}},owner {' +
        'id,__typename},@F6} QueryFragment F8 : Album {can_edit_caption,' +
        'can_upload,id,media.first(28) as ' + key + ' {edges {node {' +
        '__typename,@F4,@F5},cursor},page_info {has_next_page,' +
        'has_previous_page}},message {text},modified_time,owner {' +
        'id,name,__typename},@F6,@F7}';
    }
    return 'Query ' + type + ' {node('+ g.pageAlbumId +
      ') {@F6}} QueryFragment F0 : Photo {album {album_type,id},' +
      'can_viewer_edit,id,owner {id,__typename}} QueryFragment F1 : ' +
      'Photo {can_viewer_delete,id} QueryFragment F2 : Feedback ' +
      '{does_viewer_like,id} QueryFragment F3 : Photo {id,album {id,name},' +
      'feedback {id,can_viewer_comment,can_viewer_like,likers {count},' +
      'comments {count},@F2}} QueryFragment F4 : Photo {can_viewer_edit,id,' +
      'image as _image1LP0rd {uri},url,modified_time,message {text},' +
      '@F0,@F1,@F3} QueryFragment F5 : Node ' +
      '{id,__typename} QueryFragment F6 : ' + target +
      '.first(28) as ' + key +' {edges {node {__typename,@F4,@F5},cursor},' +
      'page_info {has_next_page,has_previous_page}}}';
  } else {
    if (g.pageType === 'other' && !g.elms.length && !g.ajaxStartFrom) {
      return 'Query MediaPageRoute {node(' + g.pageId + ') {id,__typename,' +
        '@F5}} QueryFragment F0 : Photo {album {album_type,id},' +
        'can_viewer_edit,id,owner {id,__typename}} QueryFragment F1 : ' +
        'Photo {can_viewer_delete,id} QueryFragment F2 : Feedback {' +
        'does_viewer_like,id} QueryFragment F3 : Photo {id,album {id,name}' +
        ',feedback {id,can_viewer_comment,can_viewer_like,likers {count},' +
        'comments {count},@F2}} QueryFragment F4 : Photo {can_viewer_edit,' +
        'id,image as _image1LP0rd {uri},url,modified_time,message {text},' +
        '@F0,@F1,@F3} QueryFragment F5 : Page {id,photos_by_others.first(28)' +
        ' as _photos_by_others4vtdVT {count,edges {node {id,@F4},cursor}, ' +
        'page_info {has_next_page,has_previous_page}}}';
    }
    return 'Query ' + type + ' {node(' + g.pageId +
      ') {@F3}} QueryFragment F0 : Feedback {does_viewer_like,id} ' +
      'QueryFragment F1 : Photo {id,album {id,name},feedback ' +
      '{id,can_viewer_comment,can_viewer_like,likers {count},' +
      'comments {count},@F0}} QueryFragment F2 : Photo {image' +
      ' as _image1LP0rd {uri},url,id,modified_time,message {text},@F1} ' +
      'QueryFragment F3 : ' + target + '.first(28) as ' + key + ' {edges {' +
      'node {id,@F2},cursor},page_info {has_next_page,has_previous_page}}}';
  }
}
function fbLoadPage() {
  var xhr = new XMLHttpRequest();
  var docId, key, type;
  switch (g.pageType) {
    case 'album':
      docId = '2101400366588328';
      key = 'media';
      type = 'PagePhotosTabAlbumPhotosGridPaginationQuery';
      break;
    case 'other':
      docId = '2064054117024427';
      key = 'photos_by_others';
      type = 'PagePhotosTabPostByOthersPhotoGridsRelayModernPaginationQuery';
      break;
    case 'posted':
    default:
      docId = '1887586514672506';
      key = 'posted_photos';
      type = 'PagePhotosTabAllPhotosGridPaginationQuery';
  }
  xhr.onload = function() {
    var r = extractJSON(this.responseText);
    var d = (r.data.page || r.data.album)[key];
    var images = d.edges, img, e = [];
    var doc = document.createElement('div');
    for (var i = 0; i < images.length; i++) {
      img = images[i].node;
      doc.innerHTML = '<a href="' + img.url + '" rel="theater"><img src="' +
        img.image.uri + '" alt=""></a>';
      e.push(doc.childNodes[0].cloneNode(true));
      g.last_fbid = img.id;
    }
    g.elms = g.elms.concat(e);
    if (g.pageType === 'album' && images.length) {
      g.photodata.aName = images[0].node.album.name;
    }

    g.statusEle.textContent = 'Loading album... (' + g.elms.length + ')';
    document.title = '(' + g.elms.length + ') ||' + g.photodata.aName;

    if (d.page_info && d.page_info.has_next_page && !qS('#stopAjaxCkb').checked) {
      g.cursor = d.page_info.end_cursor;
      setTimeout(fbLoadPage, 1000);
    } else {
      console.log('Loaded ' + g.elms.length + ' photos.');
      g.lastLoaded = 1;
      setTimeout(getPhotos, 1000);
    }
  }
  xhr.open('POST', location.origin + '/api/graphql/');
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  var variables = '{"count":28,"cursor":"' + (g.cursor || '') + '","' +
    (g.pageAlbumId ? ('albumID":"' + g.pageAlbumId) : ('pageID":"' + g.pageId)) + '"}';
  var data = '__user=' + g.Env.user + '&fb_dtsg=' + g.fb_dtsg + 
    '&variables=' + variables + '&doc_id='+ docId;
  xhr.send(data);
}
function getFbDtsg() {
  var s = qSA('script');
  for (var i = 0; i < s.length; i++) {
    if (s[i].textContent.indexOf('DTSGInitialData') > 0) {
      s = s[i].textContent;
      break;
    }
  }
  let dtsg = s.slice(s.indexOf('DTSGInitialData'));
  dtsg = dtsg.slice(0, dtsg.indexOf('}')).split('"');
  if (!dtsg.length || !dtsg[4]) {
    fbAutoLoadFailed();
    return;
  }
  g.fb_dtsg = dtsg[4];
  let token = s.slice(s.indexOf('async_get_token'));
  token = token.slice(0, token.indexOf('}')).split('"');
  g.fb_dtsg_ag = token[2];
}
function fbAutoLoadFailed(){
  if(confirm('Cannot load required variable, refresh page to retry?')){
    location.reload();
  }else{
    g.lastLoaded=1;getPhotos();
  }
}
function fbAutoLoad(elms){
  var l; if(g.ajaxStartFrom){
    elms = [];
    g.elms = [];
    l = g.ajaxStartFrom;
  } else if (elms.length) {
    for (var i = elms.length - 1; i > elms.length - 5 && !l; i--) {
      l = getFbid(elms[i].getAttribute('ajaxify')) || getFbid(elms[i].href);
    }
    if(!l){
      alert("Autoload failed!");g.lastLoaded=1;getPhotos();
      return;
    }
  }
  var ajaxAlbum = '', targetURL, tab, pType;
  if(!g.last_fbid){
    g.last_fbid = l;
  }else if(g.last_fbid==l){
    if(g.ajaxRetry<5 && elms.length > 2){l=elms[elms.length-2].href;l=l.slice(l.indexOf('=')+1,l.indexOf('&'));g.ajaxRetry++;}
    else if(confirm('Reaches end of album / Timeouted.\nTry again->OK\nOutput loaded photos->Cancel')){g.ajaxRetry=0;}else{g.lastLoaded=1;getPhotos();return;}
  }else{
    g.last_fbid=l;
  }
  var p = location.href + '&';
  var isAl = p.match(/media\/set|media|set=a/)
  var aInfo = {};
  var isPS = p.match(/photos_stream/);
  var isGp = p.match(/group/);
  var isGraph = p.match(/search/);
  if (g.isPage && !g.isVideo) {
    if (!g.pageId){
      fbAutoLoadFailed();
      return;
    }
    if (p.match(/album_id=/)) {
      p = qS('.uiMediaThumb, [data-token] a');
      if (!p) {
        return fbAutoLoadFailed();
      }
      p = p.getAttribute('href').match(/a\.[\.\d]+/g);
      g.pageType = 'album';
      g.pageAlbumId = p[p.length - 1].split('.')[1];
    }
    getFbDtsg();
    g.elms = [];
    return fbLoadPage();
  }
  if (g.isPage) {
    if (!g.cursor) {
      var s = qSA('script');
      for (var i = 0; i < s.length; i++) {
        if (s[i].textContent.indexOf('cursor') > 0) {
          s = s[i].textContent;
          break;
        }
      }
      var cursor = null;
      try {
        cursor = extractJSON(s);
        var idx = cursor.jscc_map.indexOf('Pagelet');
        g.cursor = extractJSON(cursor.jscc_map.slice(idx));
      } catch (e) {}
      if (!cursor) {
        return fbAutoLoadFailed();
      }
    }
  } else if (isGp) {
    p = elms[0].href.match(/g\.(\d+)/)[1];
    aInfo = {
      scroll_load: true,
      last_fbid: l,
      fetch_size: 120,
      group_id: p,
      filter: g.isVideo ? 'videos' : 'photos'
    };
  }else if (isAl){
    if (!g.isPage) {
      p = p.match(/set=([\w+\.\d]*)&/) || p;
      p = p.length ? p[1] : p.slice(p.indexOf('=')+1,p.indexOf('&'));
      aInfo={"scroll_load":true,"last_fbid":l,"fetch_size":32,"profile_id":+g.pageId,"viewmode":null,"set":p,"type":"1"};
    }

    var token = qS("div[aria-role='tabpanel']");
    if (token && token.id) {
      token = token.id.split("_")[4];
      var user = token.split(':')[0];
      var tnext = qS('.fbPhotoAlbumTitle').nextSibling;
      var isCollab = tnext && tnext.className != 'fbPhotoAlbumActions' &&
        tnext.querySelectorAll('[data-hovercard]').length > 1;
      
      if (location.href.match(/collection_token/) || isCollab || g.isVideo) {
        aInfo.collection_token = token;
        aInfo.profile_id = user;
      }
    }
    if (g.isVideo) {
      p = qS('#pagelet_timeline_medley_photos a[aria-selected="true"]');
      var lst = parseQuery(unescape(p.getAttribute('href')).split('?')[1]);
      aInfo.cursor = '0';
      aInfo.tab_key = 'media_set';
      aInfo.type = '2';
      aInfo.lst = lst.lst;
    }
  }else if(isGraph){
    var query = {};
    if(!g.query){
      var s=qSA("script"), temp=[];
      for(var i=0;i<s.length;i++){
        if (s[i].textContent.indexOf('encoded_query') > 0) {
          temp[0] = s[i].textContent;
        }
        if(s[i].textContent.indexOf('cursor:"') > 0) {
          temp[1] = s[i].textContent;
        }
      }
      query = temp[0];
      var cursor = temp[1];
      query = extractJSON(query);
      cursor = extractJSON(cursor);
      if (!query || !cursor) {
        fbAutoLoadFailed();
        return;
      }
      var rq = query.jsmods.require;
      for(i=0; i<rq.length; i++){
        if(rq[i][0] == "BrowseScrollingPager"){
          query = rq[i][3][0].globalData;
          break;
        }
      }
      rq = cursor.jsmods.require;
      for(i=0; i<rq.length; i++){
        if(rq[i][0] == "BrowseScrollingPager"){
          cursor = rq[i][3][0].cursor;
          break;
        }
      }
      query.cursor = cursor;
      query.ads_at_end = false;
      g.query = query;
    }else{
      query = g.query;
      query.cursor = g.cursor;
    }
    aInfo = query;
  }else if(!g.newL){
    var ele = qS('#pagelet_timeline_main_column');
    if (ele) {
      p = JSON.parse(ele.dataset.gt).profile_owner;
    } else if (ele = qS('#pagesHeaderLikeButton [data-profileid]')) {
      p = ele.dataset.profileid;
    } else {
      alert('Cannot get profile id!');
      return;
    }
    aInfo={"scroll_load":true,"last_fbid":l,"fetch_size":32,"profile_id":+p,"tab_key":"photos"+(isPS?'_stream':''),"sk":"photos"+(isPS?'_stream':'')};
  } else if (!ajaxAlbum) {
    p = qS('#pagelet_timeline_medley_photos a[aria-selected="true"]');
    if (!p) {
      return alert('Please go to photos tab or album.');
    }
    var lst = unescape(p.getAttribute('href')).split('?')[1];
    if (!lst) {
      return fbAutoLoadFailed();
    }
    lst = parseQuery(lst);
    p = p.getAttribute('aria-controls').match(/.*_(.*)/)[1];
    var userId = p.match(/(\d*):.*/)[1];
    tab = +p.split(':')[2];
    if(qS('.hidden_elem .fbStarGrid')){
      var t=qS('.hidden_elem .fbStarGrid');t.parentNode.removeChild(t);getPhotos();return;
    }
    if (!g.cursor) {
      var s = qSA('script');
      for (i = 0; i < s.length; i++) {
        if (s[i].textContent.indexOf('MedleyPageletRequestData') > 0) {
          try {
            rq = extractJSON(s[i].textContent).jsmods.require;
            rq.forEach(function(e) {
              if (e && e[0] === 'MedleyPageletRequestData') {
                g.pageletToken = e[3][0].pagelet_token;
              }
            })
          } catch (e) {}
        } else if (s[i].textContent.indexOf('enableContentLoader') > 0) {
          try {
            rq = extractJSON(s[i].textContent).jsmods.require;
            rq.forEach(function(e) {
              if (e && e[1] === 'enableContentLoader') {
                g.cursor = e[3][2];
              }
            });
          } catch (e) {}
        }
      }
      if (!g.cursor || !g.pageletToken) {
        alert('Cannot get cursor for auto load!');
      }
    }
    aInfo = {
      collection_token: p,
      cursor: g.cursor, 
      disablepager: false, overview: false,
      profile_id: userId,
      pagelet_token: g.pageletToken,
      tab_key: tab === 5 ? 'photos' : 'photos_of',
      lst: lst.lst,
      ftid: null, order: null, sk: 'photos', importer_state: null
    };
  }
  if (g.isPage) {
    ajaxAlbum = location.origin + '/ajax/pagelet/generic.php/' +
      'PagesVideoHubVideoContainerPagelet?data=' +
      escape(JSON.stringify(g.cursor)) + '&__user=' + g.Env.user + '&__a=1';
  } else if (isGraph) {
    ajaxAlbum = location.origin + '/ajax/pagelet/generic.php/' +
      'BrowseScrollingSetPagelet?data=' + escape(JSON.stringify(aInfo)) +
      '&__user=' + g.Env.user + '&__a=1';
  }else if(!g.newL || isGp || isAl){
    targetURL = isGp ? 'GroupPhotoset' : (g.isVideo ? 'TimelinePhotoSet' :
      'TimelinePhotos' + (isAl ? 'Album' : (isPS ? 'Stream' : '')));
    ajaxAlbum = location.origin + '/ajax/pagelet/generic.php/' + targetURL +
      'Pagelet?ajaxpipe=1&ajaxpipe_token=' + g.Env.ajaxpipe_token +
      '&no_script_path=1&data=' + JSON.stringify(aInfo) + '&__user=' + 
      g.Env.user + '&__a=1&__adt=2';
  }else{
    var req = 5+(qSA('.fbStarGrid>div').length-8)/8*2
    tab=qSA('#pagelet_timeline_medley_photos a[role="tab"]');
    pType = +p.split(':')[2];
    targetURL = "";
    switch(pType){
      case 4: targetURL = 'TaggedPhotosAppCollection'; break;
      case 5: targetURL = 'AllPhotosAppCollection'; break;
      case 70: targetURL = "UntaggedPhotosAppCollection";
      cursor = btoa('0:not_structured:'+l);
      aInfo = {"collection_token": p, "cursor": cursor, "tab_key": "photos_untagged","profile_id": +userId,"overview":false,"ftid":null,"sk":"photos"}; break;
    }
    ajaxAlbum = location.origin + '/ajax/pagelet/generic.php/' + targetURL+
      'Pagelet?data=' + escape(JSON.stringify(aInfo)) + '&__user=' +
      g.Env.user+'&__a=1';
  }
  var xhr = new XMLHttpRequest();
  xhr.onload = function(){
    clearTimeout( g.timeout );
    if(this.status!=200){
      if(!confirm('Autoload failed.\nTry again->OK\nOutput loaded photos->Cancel')){g.lastLoaded=1;}getPhotos();return;
    }
    var r=this.response,htmlBase=document.createElement('html');
    var newL = r.indexOf('for')==0;

    var eCount = 0, e, old;
    if(!newL){
      htmlBase.innerHTML=r.slice(6,-7);
      var targetJS=htmlBase.querySelectorAll('script');
      for(var k=0;!newL && k<targetJS.length;k++){
        var t=targetJS[k].textContent,content=t.slice(t.indexOf(', {')+2,t.indexOf('}, true);}')+1);
        if(!content.length||t.indexOf('JSONPTransport')<0){continue;}
        content=JSON.parse(content);
        var d=document.createElement('div');
        d.innerHTML=content.payload.content.content;
        e=d.querySelectorAll(g.thumbSelector);
        if(!e||!e.length)continue;
        eCount+=e.length;
        old=elms?Array.prototype.slice.call(elms,0):'';
        g.elms=old?old.concat(Array.prototype.slice.call(e,0)):e;
      }
    }else{
      r = JSON.parse(r.slice(9));
      htmlBase.innerHTML = r.payload;
      var e = [], temp = [];
      if(g.query){
        temp = htmlBase.querySelectorAll('a[rel="theater"]');
        for(k = 0; k < temp.length; k++){
          if (temp[k].querySelector('img')) {
            e.push(temp[k]);
          }
        }
        temp = [];
        if(e.length)g.cursor = parseQuery(e[e.length-1].href).opaqueCursor;
      }else{
        e = htmlBase.querySelectorAll(g.thumbSelector);
        if (g.pageletToken) {
          g.cursor = '';
          r.jsmods.require.forEach(function(e) {
            if (e && e[1] === 'enableContentLoader') {
              g.cursor = e[3][2];
            }
          });
          if (!g.cursor) {
            g.lastLoaded = 1;
          }
        }
      }
      var map = {};
      for (k = 0; k < e.length; k++) {
        var href = unescape(e[k].getAttribute('ajaxify')) || e[k].href;
        if (!map[href]) {
          map[href] = 1;
          temp.push(e[k]);
        }
      }
      e = temp;
      eCount+=e.length;
      old=elms?Array.prototype.slice.call(elms,0):'';
      g.elms=old?old.concat(Array.prototype.slice.call(e,0)):e;
    }
    if (g.isPage) {
      if (r.jscc_map) {
        g.cursor = extractJSON(r.jscc_map.slice(r.jscc_map.indexOf('Pagelet')));
      } else {
        g.lastLoaded = 1;
        g.cursor = '';
      }
    }
    g.statusEle.textContent = 'Loading album... (' + g.elms.length + ')';
    document.title='('+g.elms.length+') ||'+g.photodata.aName;

    if(!eCount){console.log('Loaded '+g.elms.length+' photos.');g.lastLoaded=1;}
    if (g.ajaxStartFrom) {
      g.ajaxStartFrom = false;
    }
    setTimeout(getPhotos,1000);
  };
  ajaxAlbum += `&fb_dtsg_ag=${g.fb_dtsg_ag}`;
  xhr.open("GET", ajaxAlbum);
  g.timeout=setTimeout(function(){
    xhr.abort();
    if(g.ajaxRetry>5){if(confirm('Timeout reached.\nTry again->OK\nOutput loaded photos->Cancel')){g.ajaxRetry=0;}else{g.lastLoaded=1;}}getPhotos();
  },10000);
  xhr.send();
}
function _instaQueryAdd(elms) {
  for (var i = 0; i < elms.length; i++) {
    var feed = elms[i];
    if (!elms || g.downloaded[feed.id]) {
      continue;
    } else {
      g.downloaded[feed.id] = 1;
    }
    var c = feed.edge_media_to_comment || {count: 0};
    var cList = [c.count];
    for (var k = 0; c.edges && k < c.edges.length; k++) {
      var p = c.edges[k].node;
      cList.push({
        name: p.owner.username,
        url: 'http://instagram.com/' + p.owner.username,
        text: p.text,
        date: parseTime(p.created_at)
      });
    }
    var url;
    var isAlbum = feed.__typename === 'GraphSidecar';
    var edges = !isAlbum ? [feed] : feed.edge_sidecar_to_children.edges;
    for (var j = 0; j < edges.length; j++) {
      var n = !isAlbum ? edges[j] : edges[j].node;
      url = parseFbSrc(n.display_url || n.display_src);
      var caption = feed.edge_media_to_caption;
      if (caption) {
        caption = caption.edges.length ? caption.edges[0].node.text : '';
      }
      var tags = n.edge_media_to_tagged_user;
      var tagHtml = '';
      if (tags && tags.edges && tags.edges.length) {
        tagHtml = '<div class="fbPhotosPhotoTagboxes"><div class="tagsWrapper">';
        for (k = 0; k < tags.edges.length; k++) {
          var node = tags.edges[k].node;
          var username = node.user.username;
          tagHtml += '<a target="_blank" href="https://instagram.com/' + username +
            '"><div class="fbPhotosPhotoTagboxBase tagBox igTag" style="left:' +
            parsePos(node.x) +'%;top:' + parsePos(node.y) +
            '%"><div class="tag"><div class="tagPointer">' +
            '<i class="tagArrow "></i><div class="tagName"><span>' + username +
            '</span></div></div></div></div></a>';
        }
        tagHtml += '</div></div>';
      }
      var date = feed.date || feed.taken_at_timestamp;
      const p = {
        title: j === 0 && caption ? caption : (feed.caption || ''),
        url: url,
        href: `https://www.instagram.com/p/${feed.shortcode}/`,
        date: date ? parseTime(date) : '',
        comments: c.count && j === 0 && cList.length > 1 ? cList : '',
        tag: tagHtml
      };
      if (n.is_video) {
        p.videoIdx = g.photodata.videos.length;
        g.photodata.videos.push({
          url: n.video_url,
          thumb: url
        });
      }
      g.photodata.photos.push(p);
    }
  }
}
function _instaQueryProcess(elms) {
  for (var i = 0; i < elms.length; i++) {
    if (elms[i].node) {
      elms[i] = elms[i].node;
    }
    var feed = elms[i];
    if (!elms[i] || (g.downloaded && g.downloaded[feed.id])) {
      continue;
    }
    if (feed.__typename === 'GraphSidecar' || feed.__typename === 'GraphVideo') {
      var albumHasVideo = feed.edge_sidecar_to_children &&
        feed.edge_sidecar_to_children.edges
        .filter(e => e.node.is_video && !e.node.video_url).length;
      if (g.skipAlbum) {
        elms[i] = null;
        continue;
      } else if (albumHasVideo && !feed.video_url) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
          try {
            var data = JSON.parse(this.response);
            elms[i] = data.graphql.shortcode_media;
          } catch (e) {
            elms[i] = null;
          }
          setTimeout(function() {
            _instaQueryProcess(elms);
          }, 500);
        };
        var code = feed.shortcode || feed.code;
        xhr.open('GET', 'https://www.instagram.com/p/' + code + '/?__a=1');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-Instagram-GIS', md5(g.rhx_gis + ':/p/' + code + '/'));
        xhr.send();
        return;
      }
    }
  }
  _instaQueryAdd(elms);
  var total = g.total;
  var photodata = g.photodata;
  console.log('Loaded '+photodata.photos.length+' of '+total+' photos.');
  g.statusEle.textContent = 'Loaded ' + photodata.photos.length + ' / '+ total;
  document.title="("+photodata.photos.length+"/"+total+") ||"+photodata.aName;
  if (qS('#stopAjaxCkb') && qS('#stopAjaxCkb').checked) {
    output();
  } else if (g.ajax && +g.mode !== 2) {
    setTimeout(instaQuery, 1000);
  } else {
    output();
  }
}
function instaQuery() {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    if (xhr.status === 429) {
      alert('Too many request, Please try again later.');
      if (!qS('.daExtra').innerHTML) {
        qS('.daExtra').innerHTML = '<a class="daContinue">Continue</a>';
        qS('.daContinue').addEventListener('click', instaQuery);
      }
      return;
    }
    if (this.response[0] == '<') {
      if (confirm('Cannot load comments, continue?')) {
        g.loadCm = false;
        instaQuery();
      }
      return;
    }
    var res = JSON.parse(this.response).data.user
    res = g.isTagged ? res.edge_user_to_photos_of_you : res.edge_owner_to_timeline_media;
    g.ajax = res.page_info.has_next_page ? res.page_info.end_cursor : null;
    _instaQueryProcess(res.edges);
  };
  var variables = JSON.stringify({ id: g.Env.user.id, first: 30, after: g.ajax });
  xhr.open('GET', 'https://www.instagram.com/graphql/query/?' +
    'query_hash=' + g.queryHash + '&variables=' + variables);
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.setRequestHeader('X-Instagram-GIS', md5(g.rhx_gis + ':' + variables));
  xhr.send();
}
function getInstagramQueryId() {
  const s = qS('script[src*="ProfilePageContainer"], script[src*="Commons"]');
  const xhr = new XMLHttpRequest();
  xhr.onload = function() {
    const src = this.response.replace(/void 0/g, '');
    const regex = new RegExp(`${g.isTagged ? 'taggedPosts' : 'profilePosts'}\\S+queryId:"(\\S+)"`)
    let id = src.match(regex);
    if (id) {
      g.queryHash = id[1];
    } else {
      //alert('Cannot get query id, using fallback instead');
      g.queryHash = g.isTagged ? 'de71ba2f35e0b59023504cfeb5b9857e' : 'a5164aed103f24b03e7b7747a2d94e3c';
    }
    if (g.isTagged) {
      g.ajax = '';
      return instaQuery();
    }
    getInstagram();
  };
  xhr.open('GET', s.src);
  xhr.send();
}
function getInstagram() {
  if (g.start != 2 || g.start == 3) {
    return;
  }
  g.start = 3;
  if (g.Env.user.biography !== undefined) {
    if (!g.Env.media) {
      closeDialog();
      return alert('Cannot download private account.');
    }
    var res = g.Env.media;
    g.ajax = res.page_info.has_next_page ? res.page_info.end_cursor : null;
    _instaQueryProcess(res.edges);
  }
}
async function getTwitter() {
  let url = 'https://api.twitter.com/2/timeline/media/' + g.id +
    '.json?skip_status=1&tweet_mode=extended&include_entities=false&count=20' +
    (g.ajax ? ('&cursor=' + encodeURIComponent(g.ajax)) : '');
  let r = await fetch(url, { credentials: 'include', headers: {
    'authorization': 'Bearer ' + g.token,
    'x-csrf-token': g.csrf
  }});
  r = await r.json();
  const photodata = g.photodata;
  let keys = Object.keys(r.globalObjects.tweets);
  keys.sort((a, b) => (+b - +a));
  if (g.photodata.aAuth === null) {
    const user = r.globalObjects.users[g.id];
    photodata.aName = user.screen_name;
    photodata.aAuth = user.name;
    photodata.aDes = user.description;
    g.total = user.media_count;
    g.aTime = parseTime(new Date(r.globalObjects.tweets[keys[0]].created_at), true);
  }
  for (let k = 0; k < keys.length; k++) {
    const t = r.globalObjects.tweets[keys[k]];
    if (!t.extended_entities) {
      continue;
    }
    const media = t.extended_entities.media;
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      const p = {
        title: i === 0 ? t.text : '',
        url: m.media_url_https + ':orig',
        href: 'https://' + m.display_url,
        date: parseTime(new Date(t.created_at), true)
      };
      if (m.type === 'video') {
        p.videoIdx = photodata.videos.length;
        m.video_info.variants.sort((a, b) => ((b.bitrate || 0) - (a.bitrate || 0)));
        photodata.videos.push({
          url: m.video_info.variants[0].url,
          thumb: m.media_url_https
        });
      }
      photodata.photos.push(p);
    }
  }
  const e = r.timeline.instructions[0].addEntries.entries;
  if (keys.length === 20 && e[e.length - 1].entryId.indexOf('cursor-bottom') > -1) {
    const cursor = e[e.length - 1].content.operation.cursor.value;
    g.ajax = g.ajax === cursor ? false : cursor;
  } else {
    g.ajax = false;
  }
  document.title = `${photodata.photos.length}/${g.total} || ${photodata.aName}`;
  g.statusEle.textContent = photodata.photos.length + '/' + g.total;
  if (qS('#stopAjaxCkb') && qS('#stopAjaxCkb').checked) {
    output();
  } else if (g.ajax) {
    setTimeout(getTwitter, 1000);
  } else {
    output();
  }
}
async function getTwitterInit() {
  let r = await fetch(qS('link[href*="/main"]').getAttribute('href'));
  r = await r.text();
  r = r.match(/="([\w\d]+%3D[\w\d]+)"/g);
  if (!r) {
    alert('Cannot get auth token');
    return;
  }
  g.token = r[0].slice(2, -1);
  getTwitter();
}
function getWeibo() {
  GM_xmlhttpRequest({
    method: "GET",
    url: `https://www.weibo.com/p/aj/album/loading?owner_uid=${g.uId}&page_id=${g.pageId}&page=${g.ajaxPage}&ajax_call=1&since_id=${g.ajax}`,
    onload: function(res) {
      g.ajaxPage++;
      var html = getDOM(JSON.parse(res.response).data);
      var loading = html.querySelector('[node-type="loading"]').getAttribute('action-data');
      g.ajax = parseQuery(loading).since_id;
      var links = html.querySelectorAll("a.ph_ar_box");
      var img = html.querySelectorAll("img.photo_pict");
      for(var imgCount = 0; imgCount < links.length; imgCount++){
        var data = parseQuery(links[imgCount].getAttribute("action-data"));
        var url = img[imgCount].src.match(/:\/\/([\w\.]+)\//);
        url = 'https://' + url[1] + '/large/' + data.pid + '.jpg';
        if(!g.downloaded[url]){g.downloaded[url]=1;}else{continue;}
        // For href since pid !== photo_id therefore cannot use direct link
        g.photodata.photos.push({
          title: '',
          url: url,
          href: `http://photo.weibo.com/${g.uId}/wbphotos/large/mid/${data.mid}/pid/${data.pid}`,
          date: ''
        });
      }
      const count = g.photodata.photos.length;
      log(`Loaded ${count} photos.`);
      document.title=`(${count}) ||${g.photodata.aName}`;
      g.statusEle.textContent = `Loaded ${count}`;
      if(qS('#stopAjaxCkb')&&qS('#stopAjaxCkb').checked){output();}
      else if(g.ajax){setTimeout(getWeibo, 2000);}else{output();}
    }
  });
}
function getWeiboAlbum() {
  if (!GM_xmlhttpRequest) { return alert("This script required Greasemonkey/Tampermonkey!"); }
  GM_xmlhttpRequest({
    method: "GET",
    url: `https://photo.weibo.com/albums/get_all?uid=${g.uId}&page=1&count=20`,
    onload: function(res) {
      try {
        const list = JSON.parse(res.response).data.album_list;
        g.statusEle.innerHTML = '<p>Select album to download:</p>'
        for (let i = 0; i < list.length; i++) {
          const a = document.createElement('a');
          const count = list[i].count.photos;
          a.textContent = `${list[i].caption} (${count} photos)`;
          a.addEventListener('click', () => {
            g.aId = list[i].album_id;
            g.photodata.aName = list[i].caption;
            g.total = count;
            loadWeiboAlbum();
          });
          g.statusEle.appendChild(a);
        }
      } catch (e) {
        console.error(e);
        alert('Cannot get album list, try old method instead.');
        getWeibo();
      }
    }
  });
}
function loadWeiboAlbum() {
  GM_xmlhttpRequest({
    method: "GET",
    url: `https://photo.weibo.com/photos/get_all?uid=${g.uId}&` +
      `album_id=${g.aId}&count=30&page=${g.ajaxPage}&type=3`,
    onload: function(res) {
      g.ajaxPage++;
      let ended = false;
      try {
        const list = JSON.parse(res.response).data.photo_list;
        ended = list.length === 0;
        if (ended) {
          alert('Reached end of album due to author setting.');
        }
        let lastCaption = '';
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          const url = `${e.pic_host}/large/${e.pic_name}`;
          if (!g.downloaded[url]) { g.downloaded[url] = 1; } else { continue; }
          g.photodata.photos.push({
            title: e.caption == lastCaption ? '' : e.caption,
            url: url,
            href: `https://photo.weibo.com/${g.uId}/talbum/detail/photo_id/${e.photo_id}`,
            date: parseTime(e.timestamp)
          });
          lastCaption = e.caption;
        }
        const count = g.photodata.photos.length;
        log(`Loaded ${count} photos.`);
        document.title=`(${count}/${g.total}) ||${g.photodata.aName}`;
        g.statusEle.textContent = `Loaded ${count}/${g.total}`;
        if (qS('#stopAjaxCkb') && qS('#stopAjaxCkb').checked || ended) {
          output();
        } else if (count < g.total) {
          setTimeout(loadWeiboAlbum, 2000);
        } else {
          output();
        }
      } catch (e) {
        console.error(e);
        alert('Cannot get album photos, try old method instead.');
        getWeibo();
      }
    }
  });
}
function parsePinterest(list){
  var photodata = g.photodata;
  for(var j = 0; j < list.length; j++){
    if (list[j].name || !list[j].images) {
      continue;
    }
    photodata.photos.push({
      title: list[j].description + '<br><a taget="_blank" href="' + 
        list[j].link + '">Pinned from ' + list[j].domain + '</a>',
      url: (list[j].images.orig || list[j].images['736x']).url,
      href: 'https://www.pinterest.com/pin/' + list[j].id + '/',
      date: list[j].created_at ? new Date(list[j].created_at).toLocaleString() : false
    });
  }
  log('Loaded ' + photodata.photos.length + ' photos.');
}
function getPinterest(){
  var board = location.pathname.match(/([^\/]+)/g);
  if (board && board[0] === 'pin') {
    closeDialog();
    var img = qS('.pinImage, .imageLink img');
    if (img) {
      var link = document.createElement('a');
      link.href = img.getAttribute('src');
      link.download = '';
      link.click();
    }
    return;
  }
  g.source = board ? encodeURIComponent(location.pathname) : '/';
  var s = qS('#initial-state') ? extractJSON(getText('#initial-state')) : null;
  if (!s) {
    var doc = qSA('script');
    for (var i = 0; i < doc.length; i++) {
      var c = doc[i].textContent;
      if (c.indexOf('__INITIAL_STATE__') > 0) {
        s = extractJSON(c.replace(/\\\\\\"/g, '\'').replace(/\\"/g, '"'));
        break;
      }
    }
  }
  if (!s || !s.ui || !s.ui.mainComponent) {
    alert('Cannot load initial state');
    return;
  }
  var type = s.ui.mainComponent.current;
  var resources = s.resources.data;
  while (resources && !resources.data) {
    const key = Object.keys(resources).filter(k => k !== 'UserResource')[0];
    resources = resources[key];
  }
  var r = resources && resources.data ? resources.data : null;
  g.resource = type.replace(/Feed|Page/g, '') + 'FeedResource';
  switch (type) {
    case 'HomePage':
      parsePinterest(r);
      g.bookmarks = {
        bookmarks: [resources.nextBookmark],
        prependPartner: false,
        prependUserNews: false,
        prependExploreRep: null,
        field_set_key: 'hf_grid'
      };
      g.resource = 'UserHomefeedResource';
      break;
    case 'BoardPage':
      g.bookmarks = {
        board_id: r.id,
        board_url: r.url,
        field_set_key: 'react_grid_pin',
        layout: 'default',
        page_size: 25
      };
      break;
    case 'BoardSectionPage':
      g.bookmarks = {
        section_id: r.id,
        page_size: 25
      };
      g.resource = 'BoardSectionPinsResource';
      g.photodata.aName += ' - ' + r.title;
      break;
    case 'DomainFeedPage':
      g.bookmarks = {domain: board[2]};
      break;
    case 'ProfilePage':
      switch (board[2]) {
        case 'pins': 
          g.bookmarks = {username: board[1], field_set_key: 'grid_item'};
          g.resource = 'UserPinsResource';
          break;
        case 'likes':
          g.bookmarks = {username: board[1], page_size: 25};
          g.resource = 'UserLikesResource';
          break;
      }
      break;
    case 'SearchPage':
      var query = location.search.slice(1).replace(/&/g, '=').split('=');
      query = query[query.indexOf('q') + 1];
      g.bookmarks = {query: query, scope: board[2]};
      break;
    case 'TopicFeedPage':
      g.bookmarks = {interest: board[2]};
      break;
    case 'InterestFeedPage':
      g.bookmarks = {query: board[2]};
      break;
    default:
      alert('Download type not supported.');
      return;
  }
  if (type === 'SearchPage' || type === 'InterestFeedPage') {   
    if (r.results) {
      parsePinterest(r.results);
    }
    if (resources.nextBookmark) {
      g.bookmarks.bookmarks = [resources.nextBookmark];
    }
    g.resource = 'SearchResource';
  }
  getPinterest_sub();
}
function getPinterest_sub(){
  var photodata = g.photodata;
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var r = JSON.parse(this.responseText);
    parsePinterest(r.resource_response.data);
    g.bookmarks = r.resource.options;

    document.title="("+g.photodata.photos.length+") ||"+g.photodata.aName;
    g.statusEle.textContent = g.photodata.photos.length + '/' + g.total;
    if(qS('#stopAjaxCkb')&&qS('#stopAjaxCkb').checked){output();}
    else if(g.bookmarks.bookmarks[0] != '-end-'){
      setTimeout(getPinterest_sub, 1000);
    }else{
      output();
    }
  };
  var data = {
    "options" : g.bookmarks,
    "context": {}
  };
  var url = location.origin + '/resource/' + g.resource + '/get/';
  var data = 'source_url=' + g.source + '&data=' +
    escape(JSON.stringify(data)) + '&_=' + (+new Date());
  xhr.open('POST', url);
  xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  var token = g.token || document.cookie.match(/csrftoken=(\S+);/)
  if(token){
    if(!g.token){
      token = token[1];
      g.token = token;
    }
    xhr.setRequestHeader('X-CSRFToken', token);
    xhr.setRequestHeader('X-NEW-APP', 1);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.send(data);
  }else{
    alert('Missing token!');
  }
}
function getAskFM() {
  var url = g.page || (location.protocol + '//ask.fm/' + g.username + 
    '?no_prev_link=true');
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var html = getDOM(this.response);
    var hasMore = html.querySelector('.item-page-next');
    var elms = html.querySelectorAll('.streamItem_visual');
    var i, box, link, title, url, video;
    var photodata = g.photodata;
    for (var i = 0; i < elms.length; i++) {
      box = getParent(elms[i], '.item');
      var img = elms[i].querySelector('img');
      if (!img) {
        continue;
      }
      video = box.querySelector('.playIcon');
      if (video) {
        url = img.getAttribute('src');
        photodata.videos.push({
          url: img.parentNode.getAttribute('href'),
          thumb: url
        });
      } else {
        url = img.parentNode.getAttribute('data-url') ||
          img.getAttribute('src');
      }
      link = box.querySelector('.streamItem_meta');
      var content = box.querySelector('.streamItem_content');
      if (content) {
        content.removeChild(box.querySelector('.readMore'));
      }
      title = 'Q: ' +  
        getText('.streamItem_header', 0, box) +
        ' <br>' + 'A: ' + getText('.streamItem_content', 0, box);
      photodata.photos.push({
        title: title,
        url: url,
        href: 'https://ask.fm' + link.getAttribute('href'),
        date: link.getAttribute('title'),
        videoIdx: video ? photodata.videos.length - 1 : undefined
      });
    }
    console.log('Loaded ' + photodata.photos.length + ' photos.');
    g.count += html.querySelectorAll('.item').length;
    g.statusEle.textContent = g.count + '/' + g.total;
    document.title = g.statusEle.textContent + ' ||' + g.title;
    if (g.count < g.total && hasMore && !qS('#stopAjaxCkb').checked) {
      g.page = hasMore.getAttribute('href');
      setTimeout(getAskFM, 500);
    } else {
      if (photodata.photos.length) {
        output();
      } else {
        alert('No photos loaded.');
      }
    }
  };
  xhr.open('GET', url);
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.send();
}

var dFAcore = function(setup, bypass) {
  g.start=1;g.settings={};
  if(!setup&&localStorage['dFASetting']){
    g.settings=localStorage['dFASetting']?JSON.parse(localStorage['dFASetting']):{};
  }
  g.mode=g.settings.mode||window.prompt('Please type your choice:\nNormal: 1/press Enter\nDownload without auto load: 2\nAutoload start from specific id: 3\nOptimization for large album: 4')||1;
  if(g.mode==null){return;}
  if(g.mode==3){g.ajaxStartFrom=window.prompt('Please enter the fbid:\ni.e. 123456 if photo link is:\nfacebook.com/photo.php?fbid=123456');if(!g.ajaxStartFrom){return;}}
  if(g.mode==4){g.largeAlbum=true;g.mode=window.prompt('Please type your choice:\nNormal: 1/press Enter\nDownload without auto load: 2\nAutoload start from specific id: 3');}
  g.loadCm=true;
  g.notLoadCm=g.settings.notLoadCm||!g.loadCm;
  g.largeAlbum=g.settings.largeAlbum||g.largeAlbum;
  g.settings={mode:g.mode,loadCm:g.loadCm,largeAlbum:g.largeAlbum,notLoadCm:g.notLoadCm};
  localStorage['dFASetting']=JSON.stringify(g.settings);
  var aName=document.title,aAuth="",aDes="",aTime="";g.start=2;
  g.timeOffset=new Date().getTimezoneOffset()/60*-3600000;
  createDialog();
  openWindow();
  g.statusEle = qS('.daCounter');
  if(location.host.match(/.*facebook.com/)){
    if(qS('.fbPhotoAlbumTitle')||qS('.fbxPhotoSetPageHeader')){
    aName = getText('.fbPhotoAlbumTitle') || getText("h2") ||
      getText('span[role="heading"][aria-level="3"]:only-child') || document.title;
    aAuth=getText('#fb-timeline-cover-name')||getText("h2")||getText('.fbStickyHeaderBreadcrumb .uiButtonText')||getText(".fbxPhotoSetPageHeaderByline a");
    if(!aAuth){aName=getText('.fbPhotoAlbumTitle'); aAuth=getText('h2');}
    aDes = getText('.fbPhotoCaptionText', 1) || getText('span[role="heading"][aria-level="4"]');
    try{aTime=qS('#globalContainer abbr').title;
    var aLoc=qS('.fbPhotoAlbumActionList').lastChild;
    if((!aLoc.tagName||aLoc.tagName!='SPAN')&&(!aLoc.childNodes.length||(aLoc.childNodes.length&&aLoc.childNodes[0].tagName!='IMG'))){aLoc=aLoc.outerHTML?" @ "+aLoc.outerHTML:aLoc.textContent;aTime=aTime+aLoc;}}catch(e){};
    }
    if(location.href.match('/search/')){
      var query = qS('input[name="q"][value]');
      aName = query ? query.value : document.title;
    }
    s = qSA("script");
    try{
      for(i=0,t, len = s.length; t=s[i].textContent, i<len; i++){
        if(t.match(/envFlush\({/)){
          g.Env=JSON.parse(t.slice(t.lastIndexOf("envFlush({")+9,-2)); break;
        }
      }
    }catch(e){alert('Cannot load required variable');}
    try{
      for(i=0; t=s[i].textContent, i<len; i++){
        var m = t.match(/"USER_ID":"(\d+)"/);
        if(m){
          g.Env.user = m[1]; break;
        }
      }
    }catch(e){console.warn(e);alert('Cannot load required variable');}
    getFbDtsg();
    if (!g.loadCm) {
      g.loadCm = confirm('Load caption to correct photos url?\n' +
        '(Not required for page)');
      g.notLoadCm = !g.loadCm;
    }
    g.ajaxLoaded=0;g.dataLoaded={};g.ajaxRetry=0;g.elms='';g.lastLoaded=0;g.urlLoaded={};
    g.thumbSelector = 'a.uiMediaThumb[ajaxify], a[data-video-id], ' +
      'a.uiMediaThumb[rel="theater"], a.uiMediaThumbMedium, ' +
      '.fbPhotoCurationControlWrapper a[ajaxify][rel="theater"], ' +
      'a.uiVideoLink[ajaxify], ' +
      '#fbTimelinePhotosFlexgrid a[ajaxify]:not(.fbPhotoAlbumAddPhotosButton)';
    g.downloaded={};g.profilesList={};g.commentsList={count:0};
    g.photodata = {
      aName:aName.replace(/'|"/g,'\"'),
      aAuth:aAuth.replace(/'|"/g,'\"'),
      aLink:window.location.href,
      aTime:aTime,
      photos: [],
      videos: [],
      aDes:aDes,
      largeAlbum:g.largeAlbum
    };
    g.newL = !!(qSA('#pagelet_timeline_medley_photos a[role="tab"]').length);
    var xhr = new XMLHttpRequest();
    xhr.onload = function(){
      var html = this.response;
      var doc = getDOM(html);
      var pageId = doc.querySelector('[property="al:ios:url"]');
      var content = pageId ? pageId.getAttribute('content') : '';
      if (pageId && content.match(/page|profile/)) {
        g.isPage = /page/.test(content);
        g.pageId = content.match(/\d+/)[0];
      }
      g.isVideo = location.href.match(/\/videos\/|set=v/);
      g.isPageVideo = g.isPage && g.isVideo;
      if (location.href.match('messages')) {
        g.threadId = 0;
        getFbMessagesPhotos();
      } else {
        getPhotos();
      }
    };
    xhr.open('GET', location.href);
    xhr.send();
  }else if(location.host.match(/.*instagram.com/)){
    if (location.pathname === '/') {
      return alert('Please go to profile page.');
    }
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (this.readyState === 4 && this.status === 429) {
        g.rateLimited = 1;
        alert('Rate limit reached. Please try again later.');
      }
    };
    xhr.onload = function() {
      try {
        g.Env = getSharedData(this.response);
        g.token = g.Env.config.csrf_token;
        g.rhx_gis = g.Env.rhx_gis;
        var data = g.Env.entry_data;
        if (data.ProfilePage) {
          g.Env = data.ProfilePage[0].graphql;
        } else {
          alert('Need to reload for required variable.');
          return location.reload();
        }
      } catch(e) {
        if (g.rateLimited) {
          g.rateLimited = 0;
        } else {
          console.error(e);
          alert('Cannot load required variable!');
        }
        return;
      }
      g.isTagged = location.href.indexOf('/tagged/') > 0;
      g.Env.media = g.isTagged ? { count: 0, edges: [] } :
        g.Env.user.edge_owner_to_timeline_media;
      g.total = g.Env.media.count;
      aName = g.Env.user.full_name || 'Instagram';
      aAuth = g.Env.user.username;
      aLink = g.Env.user.external_url || ('http://instagram.com/'+  aAuth);
      let aTime = 0
      try {
        aTime = g.Env.media && g.Env.media.edges.length ?
          g.Env.media.edges[0].node.taken_at_timestamp : 0;
      } catch (e) {}
      g.photodata = {
        aName: aName.replace(/'|"/g,'\"'),
        aAuth: aAuth,
        aLink: aLink,
        aTime: aTime ? 'Last Update: ' + parseTime(aTime) : '',
        photos: [],
        videos: [],
        aDes: (g.Env.user.bio || g.Env.user.biography || '').replace(/'|"/g,'\"')
      };
      g.downloaded = {};
      getInstagramQueryId();
    };
    xhr.open('GET', location.href);
    xhr.send();
  }else if(location.host.match(/twitter.com/)){
    g.csrf = document.cookie.split(';').filter(s => s.indexOf('ct0') > -1)[0].split('=')[1];
    g.id = qS('img[src*="profile_banners"]') ?
      qS('img[src*="profile_banners"]').getAttribute('src') :
      qS('[data-testid$="follow"]').dataset.testid;
    g.id = g.id.match(/\d+/)[0];
    g.ajax = '';
    g.photodata = {
      aAuth: null,
      aDes: '',
      aLink: location.href,
      aName: '',
      aTime: '',
      photos: [],
      videos: []
    };
    getTwitterInit();
  }else if(location.host.match(/weibo.com/)){
    try{
      aName='微博配圖';
      aAuth=getText('.username') || qS('.pf_photo img') ? qS('.pf_photo img').alt : '';
    }catch(e){}
    g.downloaded = {};
    var k = qSA('script'), id = '';
    for(var i=0; i<k.length && !id.length; i++){
      var t = k[i].textContent.match(/\$CONFIG\['oid'\]/);
      if(t)id = k[i].textContent;
    }
    eval(id);
    if(!$CONFIG){alert("發生錯誤，請聯絡作者");return;}
    g.uId = $CONFIG.oid;
    g.pageId = $CONFIG.page_id;
    g.ajaxPage = 1;
    g.ajax = ""
    g.photodata = {
      aName:aName,
      aAuth:aAuth,
      aLink:location.href,
      aTime:aTime,
      photos: [],
      aDes:""
    };
    getWeiboAlbum();
  }else if(location.host.match(/pinterest/)){
    g.photodata = {
      aName: getText('h3, h4') || 'Pinterest',
      aAuth: qS('.profileSource img') ? qS('.profileSource img').alt : '',
      aLink: location.href,
      aTime: aTime,
      photos: [],
      aDes: aDes
    };
    g.total = getText('.belowBoardNameContainer span') || getText('.value') ||
      getText('.fixedHeader+div span');
    getPinterest();
  }else if(location.host.match(/ask.fm/)){
    g.count = 0;
    g.page = 0;
    g.total = +getText('.profileTabAnswerCount');
    g.title = document.title;
    g.username = getText('.profile-name span:nth-of-type(2)').slice(1);
    if (!g.username) {
      g.username = location.href.split('/')[3];
    }
    g.photodata = {
      aName: getText('.profile-name span:nth-of-type(1)'),
      aAuth: g.username,
      aLink: location.href,
      aTime: aTime,
      photos: [],
      videos: [],
      aDes: getText('#sidebarBio', 1)
    };
    getAskFM();
  }
};
function sendRequest(request, sender, sendResponse) {
  if (win.closed && !needOpenWindow) {
    alert('Click Output to view photos');
    needOpenWindow = true;
    return;
  } else if (needOpenWindow) {
    needOpenWindow = false;
    openWindow();
    return;
  }
  switch(request.type){
  case 'store':
    localStorage["downAlbum"]=request.data;
    log(request.no+' photos data saved.'); break;
  case 'get':
    g.photodata=JSON.parse(localStorage["downAlbum"]);
    g.start=2;
    log(g.photodata.photos.length+' photos got.');
    getPhotos();
    break;
  case 'export':
    if(!request.data){request.data=JSON.parse(localStorage["downAlbum"]);}
    log('Exported '+request.data.photos.length+' photos.');
    var a,b=[],c=request.data;
    c.aName=(c.aName)?c.aName:"Facebook";
    c.dTime = (new Date()).toLocaleString();
    var d = c.photos,totalCount = d.length;
    for (var i=0;i<totalCount;i++) {
      if(d[i]){
      var href=d[i].href?d[i].href:'',title=d[i].title||'',tag=d[i].tag||'',comments=d[i].comments||'',tagIndi='',dateInd='',commentInd='';
      href=href?' href="'+href+'" target="_blank"':'';
      if (tag) {
        if (c.aLink.indexOf('facebook.com') > -1) {
          tag = tag.replace(/href="/g, 'target="_blank" href="https://www.facebook.com');
        }
        tag='<div class="loadedTag">'+tag+'</div>';
        tagIndi='<i class="tagArrow tagInd"></i>';
      }
      if(comments){
        var co ='<div class="loadedComment">';
        try{
          if(comments[0]>comments.length-1){
            var cLink = comments[1].fbid ? ("https://www.facebook.com/photo.php?fbid="+comments[1].fbid) : comments[1].id;
            co += '<p align="center"><a href="'+cLink+'" target="_blank">View all '+comments[0]+' comments</a></p>';
          }
        }catch(e){}
        for(var ii=1; ii<comments.length; ii++){
          var p = comments[ii];
          co += '<blockquote><p>'+p.text+'</p><small><a href="'+p.url+'" target="_blank">'+p.name+'</a> '+(p.fbid?('<a href="https://www.facebook.com/photo.php?fbid='+p.fbid+'&comment_id='+p.id+'" target="_blank">'):'')+p.date+(p.fbid?'</a>':'')+'</small></blockquote>';
        }
        comments = co + '</div>';
        commentInd='<a title="Click to view comments" rel="comments"><i class="tagArrow commentInd"></i></a>';
      }
      if(d[i].date){dateInd='<div class="dateInd"><span>'+d[i].date+'</span> <i class="tagArrow dateInd"></i></div>';}
      var videoInd = d[i].videoIdx !== undefined ?
        `<a class="videoInd" href="${c.videos[d[i].videoIdx].url}" target="_blank">🎥</a>` : ''; 
      var $t = [];
      var test = false;
      var test2 = false;
      try{if(title.match(/<.*>/))$t = $(title);}catch(e){}
      try{test = title.match(/hasCaption/) && $t.length;}catch(e){}
      try{test2 = title.match(/div/) && title.match(/span/)}catch(e){}
      try{
        if(test){
          var t=document.createElement('div');
          t.innerHTML=title;
          var junk=t.querySelector('.text_exposed_hide');
          if(junk&&junk.length)t.removeChild(junk);
          title = $t.html();
          if(title.indexOf("<br>") == 0)title = title.slice(4);
        }else if(test2){
          title = title.replace(/&(?!\w+([;\s]|$))/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        else if($t.length){
          try{
            $t.find('.text_exposed_hide').remove().end()
            .find('div *').unwrap().end()
            .find('.text_exposed_show').unwrap().end()
            .find('span').each(function() {$(this).replaceWith(this.childNodes);});
            title=$t.html();
          }catch(e){}
        } else {
          title = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
      }catch(e){}
      title=title?'<div class="captions"><a class="captions" rel="captions"></a>'+title+'</div>':'<div class="captions"></div>';
      var a = '<div rel="gallery" class="item'+(c.largeAlbum?' largeAlbum':'')+'" id="item'+i+'"><a'+href+'>'+(i*1+1)+'</a>'+commentInd+tagIndi+videoInd+dateInd+'<a class="fancybox" rel="fancybox" href="'+d[i].url+'" target="_blank"><div class="crop"><div style="background-image: url('+d[i].url+');" class="img"><img src="'+d[i].url+'"></div></div></a>'+title+tag+comments+'</div>';
      b.push(a)}
    }
    const opt = { type: 'text/plain;charset=utf-8' };
    const rawFile = new File([JSON.stringify(c)], document.title + '.txt', opt);
    const rawUrl = window.URL.createObjectURL(rawFile);
    const photos = [];
    c.photos.forEach(function(item) {
      photos.push(item.url);
    });
    const photoFile = new File([photos.join('\n')], document.title + '-photos.txt', opt);
    const photoUrl = window.URL.createObjectURL(photoFile);
    const videos = [];
    if (c.videos && c.videos.length) {
      c.videos.forEach(function(item) {
        videos.push(item.url);
      });
    }
    const videoFile = new File([videos.join('\n')], document.title + '-videos.txt', opt);
    const videoUrl = window.URL.createObjectURL(videoFile);
    var tHTML='<html><body class="index">'+'<script>document.title=\''+c.aAuth+(c.aAuth?"-":"")+c.aName+'\';</script>';
    tHTML=tHTML+'<style>body{line-height:1;background:#f5f2f2;font-size:13px;color:#444;padding-top:150px;}.crop{width:192px;height:192px;overflow:hidden;}.crop img{display:none;}div.img{width:192px;height:192px;background-size:cover;background-position:50% 25%;border:none;image-rendering:optimizeSpeed;}@media screen and (-webkit-min-device-pixel-ratio:0){div.img{image-rendering: -webkit-optimize-contrast;}}header{display:block}.wrapper{width:960px;max-width:100%;margin:0 auto;position:relative}#hd{background:#faf7f7;position:fixed;z-index:100;top:0;left:0;width:100%;}#hd .logo{padding:7px 0;border-bottom:1px solid rgba(0,0,0,0.2)}#hd h1{padding: 0 6px 6px;} #container{width:948px;position:relative;margin:0 auto}.item{width:192px;float:left;padding:5px 15px 0;margin:0 7px 15px;font-size:12px;background:white;line-height:1.5}.item .captions{color:#8c7e7e;padding-bottom:15px;overflow:hidden;height:8px;position:relative;}.item .captions:first-child{position:absolute;width:100%;height:100%;top:0;left:0;z-index:1;}#logo{background-color:#3B5998;color:#FFF}#hd .logo h1{background-color:#3B5998;left:0;position:relative;width:100%;display:block;margin:0;color:#FFF;height:100%;font-size:18px}#logo a{color:#FFF}#logo a:hover{color:#FF9}progress{width:100%}#aDes{line-height:1.4;}.largeAlbum>a{visibility:visible;}.largeAlbum .fancybox{visibility:hidden;display:none;}.oImg{background-color:#FFC}\
      .twitter-emoji, .twitter-hashflag {height: 1.25em; width: 1.25em; padding: 0 .05em 0 .1em; vertical-align: -0.2em;}\
      /* drag */ #output{display:none;background:grey;min-height:200px;margin:20px;padding:10px;border:2px dotted#fff;text-align:center;position:relative;-moz-border-radius:15px;-webkit-border-radius:15px;border-radius:15px;}#output:before{content:"Drag and Drop images.";color:#fff;font-size:50px;font-weight:bold;opacity:0.5;text-shadow:1px 1px#000;position:absolute;width:100%;left:0;top:50%;margin:-50px 0 0;z-index:1;}#output img{display:inline-block;margin:0 10px 10px 0;} button{display:inline-block;vertical-align:baseline;outline:none;cursor:pointer;text-align:center;text-decoration:none;font:700 14px/100% Arial, Helvetica, sans-serif;text-shadow:0 1px 1px rgba(0,0,0,.3);color:#d9eef7;border:solid 1px #0076a3;-webkit-border-radius:.5em;-moz-border-radius:.5em;background-color:#59F;border-radius:.5em;margin:0 2px 12px;padding:.5em 1em .55em;}.cName{display:none;}#fsCount{position: absolute;top: 20;right: 20;font-size: 3em;}\
      /*! fancyBox v2.1.3 fancyapps.com | fancyapps.com/fancybox/#license */\
      .fancybox-wrap,.fancybox-skin,.fancybox-outer,.fancybox-inner,.fancybox-image,.fancybox-wrap iframe,.fancybox-wrap object,.fancybox-nav,.fancybox-nav span,.fancybox-tmp{border:0;outline:none;vertical-align:top;margin:0;padding:0;}.fancybox-wrap{position:absolute;top:0;left:0;z-index:8020;}.fancybox-skin{position:relative;background:#f9f9f9;color:#444;text-shadow:none;-webkit-border-radius:4px;-moz-border-radius:4px;border-radius:4px;}.fancybox-opened{z-index:8030;}.fancybox-outer,.fancybox-inner{position:relative;}.fancybox-type-iframe .fancybox-inner{-webkit-overflow-scrolling:touch;}.fancybox-error{color:#444;font:14px/20px "Helvetica Neue",Helvetica,Arial,sans-serif;white-space:nowrap;margin:0;padding:15px;}.fancybox-image,.fancybox-iframe{display:block;width:100%;height:100%;}.fancybox-image{max-width:100%;max-height:100%;}#fancybox-loading,.fancybox-close,.fancybox-prev span,.fancybox-next span{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAACYBAMAAABt8RZRAAAAMFBMVEUAAAABAQEiIiIjIyM4ODhMTExmZmaCgoKAgICfn5+5ubnW1tbt7e3////+/v4PDw+0IcHsAAAAEHRSTlP///////////////////8A4CNdGQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAphJREFUSMftlE1oE0EUgNeCICru0YunaVNNSj3kbim5SqUECh7MxZMUvPQgKBQPggrSSy9SdFVC8Q8XwbNLpWhByRJQE5vsvimIFjxss14KmnTj/GR+Nrs9WH9OeZdlP96+nXnzvjG6qWHsDb+sVJK4AzSqfbgN767PXHimOMfu2zxCaPgujuGoWUA0RuyWjt0y4pHDGm43kQi7qvDF1xKf3lDYWZT4OJZ426Nfl1GO1nIk/tEgr9BEFpCnVRW4XSev87AEn8izJHHnIy1K9j5HnlMtgY98QCydJqPxjTi2gP4CnZT4MC2SJUXoOk/JIodqLHmJpatfHqRFCWMLnF+JbcdaRFmabcvtfHfPy82Pqs2HVlninKdadUw11tIauz+Y69ET+jGECyLdauiHdiB4yOgsvq/j8Bw8KqCRK7AWH4h99wAqAN/6p2po1gX/cXIGQwOZfz7I/xBvbW1VEzhijrT6cATNSzNn72ic4YDbcAvHcOQVe+32dBwsi8OB5wpHXkEc5YKm1M5XdfC+woFyZNi5KrGfZ4OzyX66InCHH3uJTqCYeorrTOCAjfdYXeCIjjeaYNNNxlNiJkPASym88566Aatc10asSAb6szvUEXQGXrD9rAvcXucr8dhKagL/5J9PAO1M6ZXaPG/rGrtPHkjsKEcyeFI1tq462DDVxYGL8k5aVbhrv5E32KR+hQFXKmNvGvrJ2941Rv1pU8fbrv/k5mUHl434VB11yFD5y4YZx+HQjae3pxWVo2mQMAfu/Dd3uDoJd8ahmOZOFr6kuYMsnE9xB+Xgc9IdEi5OukOzaynuIAcXUtwZ662kz50ptpCEO6Nc14E7fxEbiaDYSImuEaZhczc8iEEMYm/xe6btomu63L8A34zOysR2D/QAAAAASUVORK5CYII=);}#fancybox-loading{position:fixed;top:50%;left:50%;margin-top:-22px;margin-left:-22px;background-position:0 -108px;opacity:0.8;cursor:pointer;z-index:8060;}#fancybox-loading div{width:44px;height:44px;}.fancybox-close{position:absolute;top:-18px;right:-18px;width:36px;height:36px;cursor:pointer;z-index:8040;}.fancybox-nav{position:absolute;top:0;width:40%;height:100%;cursor:pointer;text-decoration:none;background:transparent url(data:image/png;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==);-webkit-tap-highlight-color:rgba(0,0,0,0);z-index:8040;}.fancybox-prev{left:-30%;}.fancybox-next{right:-30%;}.fancybox-nav span{position:absolute;top:50%;width:36px;height:34px;margin-top:-18px;cursor:pointer;z-index:8040;visibility:hidden;}.fancybox-prev span{left:10px;background-position:0 -36px;}.fancybox-next span{right:10px;background-position:0 -72px;}.fancybox-tmp{position:absolute;top:-99999px;left:-99999px;visibility:hidden;max-width:99999px;max-height:99999px;overflow:visible!important;}.fancybox-overlay{position:absolute;top:0;left:0;overflow:hidden;display:none;z-index:8010;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QjY3NjM0OUJFNDc1MTFFMTk2RENERUM5RjI5NTIwMEQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QjY3NjM0OUNFNDc1MTFFMTk2RENERUM5RjI5NTIwMEQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpCNjc2MzQ5OUU0NzUxMUUxOTZEQ0RFQzlGMjk1MjAwRCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpCNjc2MzQ5QUU0NzUxMUUxOTZEQ0RFQzlGMjk1MjAwRCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgbXtVkAAAAPSURBVHjaYhDg4dkAEGAAATEA2alCfCIAAAAASUVORK5CYII=);}.fancybox-overlay-fixed{position:fixed;bottom:0;right:0;}.fancybox-lock .fancybox-overlay{overflow:auto;overflow-y:scroll;}.fancybox-title{visibility:hidden;font:normal 13px/20px "Helvetica Neue",Helvetica,Arial,sans-serif;position:relative;text-shadow:none;z-index:8050;}.fancybox-title-float-wrap{position:absolute;bottom:0;right:50%;margin-bottom:-35px;z-index:8050;text-align:center;}.fancybox-title-float-wrap .child{display:inline-block;margin-right:-100%;background:rgba(0,0,0,0.8);-webkit-border-radius:15px;-moz-border-radius:15px;border-radius:15px;text-shadow:0 1px 2px #222;color:#FFF;font-weight:700;line-height:24px;white-space:nowrap;padding:2px 20px;}.fancybox-title-outside-wrap{position:relative;margin-top:10px;color:#fff;}.fancybox-title-inside-wrap{padding-top:10px;}.fancybox-title-over-wrap{position:absolute;bottom:0;left:0;color:#fff;background:rgba(0,0,0,.8);padding:10px;}.fancybox-inner,.fancybox-lock{overflow:hidden;}.fancybox-nav:hover span,.fancybox-opened .fancybox-title{visibility:visible;}\
      #fancybox-buttons{position:fixed;left:0;width:100%;z-index:8050;}#fancybox-buttons.top{top:10px;}#fancybox-buttons.bottom{bottom:10px;}#fancybox-buttons ul{display:block;width:400px;height:30px;list-style:none;margin:0 auto;padding:0;}#fancybox-buttons ul li{float:left;margin:0;padding:0;}#fancybox-buttons a{display:block;width:30px;height:30px;text-indent:-9999px;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaBAMAAADKhlwxAAAAMFBMVEUAAAAAAAAeHh4uLi5FRUVXV1diYmJ3d3eLi4u8vLzh4eHz8/P29vb////+/v4PDw9Xwr0qAAAAEHRSTlP///////////////////8A4CNdGQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAbVJREFUWMPtlktugzAQhnPNnqLnSRuJXaRGVFm3NmFdPMC+YHqA8NiWBHBdlPgxETRIVatWjIQ0Hn/8DL9lywsxJRYz/T10h+uxkefyiUw6xPROpw33xZHHmm4yTD9WKg2LRHhZqumwuNDW77tQkAwCRTepx2VU5y/LSEMlXkPEc3AUHTJCCESn+S4FOaZa/F7OPqm/bDLyGXCmoR8a4nLkKLrupymiwT/Thz3ZbbWDK9ZPnzxuoMeZ6sSTdKLpGthShnP68EaGIX3MGKGFrx1cAXbQDbR0ypY0TDRdX9JKWtD8RawiZqz8CtMbnR6k1zVsDfod046RP8jnbt6XM/1n6WoSzX2ryLlo+dsgXaRWsSxFV1aDdF4kZjGP5BE0TAPj5vEOII+geJgm1Gz9S5p46RSaGK1fQUMwgabPkzpxrqcZWV/vYA5PE1anDG4nrDw4VpFR0ZDhTtbzLp7p/03LW6B5qnaXV1tL27X2VusX8RjdWnTH96PapbXLuzIe7ZvdxBb9OkbXvtga9ca4EP6c38hb5DymsbduWY1pI2/bcRp5W8I4bXmLnMc08hY5P+/L36M/APYreu7rpU5/AAAAAElFTkSuQmCC);background-repeat:no-repeat;outline:none;opacity:0.8;}#fancybox-buttons a:hover{opacity:1;}#fancybox-buttons a.btnPrev{background-position:5px 0;}#fancybox-buttons a.btnNext{background-position:-33px 0;border-right:1px solid #3e3e3e;}#fancybox-buttons a.btnPlay{background-position:0 -30px;}#fancybox-buttons a.btnPlayOn{background-position:-30px -30px;}#fancybox-buttons a.btnToggle{background-position:3px -60px;border-left:1px solid #111;border-right:1px solid #3e3e3e;width:35px;}#fancybox-buttons a.btnToggleOn{background-position:-27px -60px;}#fancybox-buttons a.btnClose{border-left:1px solid #111;width:35px;background-position:-56px 0;}#fancybox-buttons a.btnDisabled{opacity:0.4;cursor:default;}\
      .loadedTag, .loadedComment{display:none}.fbphotosphototagboxes{z-index:9997}.fancybox-nav{width:10%;}.igTag{padding: 1.5em;}.tagArrow{background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAABgCAMAAADfGilYAAABQVBMVEUAAABXV1dXV1dXV1dXV1dkZGRkZGQAAABXV1dXV1fj4+NXV1cAAAAAAABXV1dXV1cAAABXV1dXV1cdHR1XV1ciIiLi4uJXV1cnJyfl5eVXV1dXV1ff399XV1dXV1dXV1dXV1dXV1dXV1cXFxcAAABXV1dXV1dXV1cAAAA3NzdXV1dXV1dXV1cAAAAAAABXV1dXV1dXV1dXV1cAAAD+/v74+PhXV1dXV1f29vYeHh4tLS0AAAAyMjJXV1f5+flXV1f7+/v///9XV1dtfq9ugLCSn8PO0+Nrfqq9xdqKmL/x8fh1h7COnL5ugK/O1eKTocGkr87O1OTN0+Gnsc7L0eH4+PuRn8Crt85tgK/c4Oyos8+qtc1ugaytuNHx8vnX2+jx8viqtdFzhbOtt9ByhLHX3OiqtdC9xtuKl7/T2ebS2ObSpKIFAAAAQXRSTlMAFCzrgWZAfNNo5fkwLiY8MnLzhWCH49mJ5yp64x5CDo0yw4MG7Xz7Co0G1T5kSmwCk/1g/fcwOPeFiWKLZvn3+z0qeQsAAAJ7SURBVHhendLXctswEAXQJSVbVrdkW457r3FN7WUBkurFvab3/P8HZAGatCIsZ6zcJ2iOLrgYAKBcrrdbrXa9XAZApAX9RAQgaaNOW8lZWedMS11BmagOcKgAiY6VNAJp0DqQhpJWIC2A60CufVHLUBBDaaBOuJtOI5wA/QmOAzk2pr7y4QoBgpOe3pz0kE56eohaoiNlpYa1ipSq8v5b88vXoCE9VPGUuOdSyqZ7Ix1qqFYHwHOcyqeKIw988WpYkRWseQAdKWv4wXE6oVBHyw/1zZ+O/BzuRtG7fafPNJ2m/OiLPNByoCaoEjmyGsxW1VIlIXZIvECopCokyiVVQqnqipaLc0de3Iq8xCPpC142j7BLXM8N5OTXiZI7ZmAgCgYHiVhAJOJBEQ+aeNBkAEcaONLAkQaeCAyCu8XKRUAyNh6PANu6H+cBwBqK82Ar4mC2qFsmjKbF/AKR3QWWgqeCki7YMatL7CELdOeBEMUkdCeuaWvFWhVrM8DQpB3bF7vAkB1LbooCmEQAcyIPBo0TQH4RzOQs8ikb+OzlIDr8bnxogtc8DFlPaDgV/qQs2Jq4RnHWJJtgYV6kRw2imyukBSWvyOqmZFGIt7rTc9swsyZWrZUtMF/IrtiP2ZMMQEFsRrzEvJgDIgMoi3kg4p61PUVsTbJXsAf/kezDhMqOActL06iSYDpL0494gcyrx6YsKxhL4bNeyT7PQmYkhaUXpR55WRpRjdRIdmxi+x9JYGqjRJCB4XvDPYJvMDWWoeU69Aq+2/D/bQpO0Ea8EK0bspNQ2WY60alLisuJ9MMK/GaJ5I/Lt6QKS24obmSpn+kgAJ4gIi70k79vocBUxmfchgAAAABJRU5ErkJggg==);background-size: auto;background-repeat: no-repeat;display: inline-block;height: 11px;width: 20px;background-position: 0 -24px;margin-top:3px;}.tagInd{background-position: 0 -83px;float:right;}.dateInd{background-position:-12px 1px;text-indent:-100%;text-align:right;float:right;}.dateInd span{font-size:11px;padding-right:3px;visibility:hidden;}.dateInd:hover span{visibility:visible;}.videoInd{float:right;margin-left:-6px;margin-top:-2px;}.vis{visibility:visible !important;}.commentInd{background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAGJJREFUKFNjgIGJi47+905fQBCD1EG1MDCABIgBIHVQLSRqmrP2wn8QHo6aeuYdAwugYxiA8cFBDtME04iOYRpBNDSgGVA0YcMwjSiaYABZIVQIBWQ3bsStCcolDhCvgYEBADd1oN6ZvLbPAAAAAElFTkSuQmCC);background-position:0 0;float:right;cursor:pointer;}blockquote {padding: 0 0 0 15px;margin: 0 0 20px;border-left: 5px solid #eeeeee;}blockquote p {margin-bottom: 0;line-height: 1.25;}blockquote small {display: block;line-height: 20px;color: #999999;font-size: 85%;}blockquote small:before {content: "— ";}\
      /* .borderTagBox & .innerTagBox */\
      .fbPhotosPhotoTagboxes{height:100%;left:0;position:absolute;top:0;width:100%;/*pointer-events:none*/}.fbPhotosPhotoTagboxes .tagsWrapper{display:inline-block;height:100%;width:100%;position:relative;vertical-align:middle}.fbPhotosPhotoTagboxBase{line-height:normal;position:absolute}.imageLoading .fbPhotosPhotoTagboxBase{display:none}/*.fbPhotosPhotoTagboxBase .borderTagBox, .fbPhotosPhotoTagboxBase .innerTagBox{-webkit-box-sizing:border-box;height:100%;width:100%}.ieContentFix{display:none;font-size:200px;height:100%;overflow:hidden;width:100%}.fbPhotosPhotoTagboxBase .innerTagBox{border:4px solid #fff;border-color:rgba(255, 255, 255, .8)}*/.fbPhotosPhotoTagboxBase .tag{bottom:0;left:50%;position:absolute}.fbPhotosPhotoTagboxBase .tagPointer{left:-50%;position:relative}.fbPhotosPhotoTagboxBase .tagArrow{left:50%;margin-left:-10px;position:absolute;top:-10px}.fbPhotosPhotoTagboxBase .tagName{background:#fff;color:#404040;cursor:default;font-weight:normal;padding:2px 6px 3px;top:3px;white-space:nowrap}.fancybox-inner:hover .fbPhotosPhotoTagboxes{opacity:1;z-index:9998;}.fbPhotosPhotoTagboxes .tagBox .tag{top:85%;z-index:9999}.fbPhotosPhotoTagboxes .tag, .fbPhotosPhotoTagboxes .innerTagBox, .fbPhotosPhotoTagboxes .borderTagBox{visibility:hidden}.tagBox:hover .tag/*, .tagBox:hover .innerTagBox*/{opacity:1;/*-webkit-transition:opacity .2s linear;*/visibility:visible}</style>';
    tHTML=tHTML+'<header id="hd"><div class="logo" id="logo"><div class="wrapper"><h1><a id="aName" href='+c.aLink+'>'+c.aName+'</a> '+((c.aAuth)?'- '+c.aAuth:"")+' <button onClick="cleanup()">ReStyle</button></h1> <h1><a download="'+c.aAuth+'.txt" target="_blank" href="'+rawUrl+'">saveRawData</a></h1> <h1><a download="'+c.aAuth+'-photos.txt" target="_blank" href="'+photoUrl+'">savePhotoUrl ('+photos.length+')</a></h1> <h1><a download="'+c.aAuth+'-videos.txt" target="_blank" href="'+videoUrl+'">saveVideoUrl ('+videos.length+')</a></h1></div></div></header>'; //<h1>Press Ctrl+S / [Mac]Command+S (with Complete option) to save all photos. [Photos are located in _files folder]</h1> 🎥 
    tHTML=tHTML+'<center id="aTime">'+c.aTime+'</center><br><center id="aDes">'+c.aDes+'</center><center>Download at: '+c.dTime+'</center><br><div id="output" class="cName"></div><div class="wrapper"><div id="bd"><div id="container" class="masonry">';
    tHTML=tHTML+b.join("")+'</div></div></div><script src="https://rawgit.com/inDream/DownAlbum/master/assets/jquery.min.js"></script></body></html>';
    win.document.open();
    win.document.write(tHTML);
    win.document.close();
    win.focus();
    break;
    }
};


var unsafeWindow = window;
unsafeWindow.name = 'main';
// console = unsafeWindow.console;
var oldurl = window.location.href
try {
  var expG = exportFunction(g, unsafeWindow, {defineAs: "g"});
  unsafeWindow.g = expG;
  var expCore = exportFunction(dFAcore, unsafeWindow, {defineAs: "dFAcore"});
  unsafeWindow.dFAcore = expCore;
} catch (e) {
  unsafeWindow.dFAcore = dFAcore;
  unsafeWindow.g = g;
}
//document.addEventListener("DOMContentLoaded", dFAinit, false);
setTimeout(dFAinit, 2000);
setInterval(() => {
    var cururl = window.location.href
    if (cururl !== oldurl) {
        oldurl = cururl
        setTimeout(dFAinit, 1000)
    }
}, 1000)

