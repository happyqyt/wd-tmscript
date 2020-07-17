// ==UserScript==
// @name        Vimeo视频下载脚本
// @namespace    https://zhang18.top
// @version      0.3.6
// @description   Vimeo视频下载脚本，可以在视频下方生成下载按钮，只支持含有1080p的视频，有个跨域请求，请允许该操作,可到上面我的博客反映Bug。
// @author       ZLOE
// @match        https://player.vimeo.com/video/*?autoplay=1
// @match        https://vimeo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js

// ==/UserScript==

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

// begin grant apis
    function GM_xmlHttpRequest(d) {
      if (!d) throw new Error(_('xhr_no_details'));
      if (!d.url) throw new Error(_('xhr_no_url'));

      let url;
      try {
        url = new URL(d.url, location.href);
      } catch (e) {
        throw new Error(_('xhr_bad_url', d.url, e));
      }

      if (url.protocol != 'http:'
          && url.protocol != 'https:'
          && url.protocol != 'ftp:'
      ) {
        throw new Error(_('xhr_bad_url_scheme', d.url));
      }

      let port = chrome.runtime.connect({name: 'UserScriptXhr'});
      port.onMessage.addListener(function(msg) {
        if (msg.responseState.responseXML) {
          try {
            msg.responseState.responseXML = (new DOMParser()).parseFromString(
                msg.responseState.responseText,
                'application/xml');
          } catch (e) {
            console.warn('GM_xhr could not parse XML:', e);
            msg.responseState.responseXML = null;
          }
        }
        let o = msg.src == 'up' ? d.upload : d;
        let cb = o['on' + msg.type];
        if (cb) cb(msg.responseState);
      });

      let noCallbackDetails = {};
      Object.keys(d).forEach(k => {
        let v = d[k];
        noCallbackDetails[k] = v;
        if ('function' == typeof v) noCallbackDetails[k] = true;
      });
      noCallbackDetails.upload = {};
      d.upload && Object.keys(k => noCallbackDetails.upload[k] = true);
      noCallbackDetails.url = url.href;
      port.postMessage({
        'details': noCallbackDetails,
        'name': 'open',
        'uuid': _uuid,
      });

      // TODO: Return an object which can be `.abort()`ed.
    }
    function GM_download(arg1, name) {
      // not using ... as it calls Babel's polyfill that calls unsafe Object.xxx
      let opts = {};
      let onload;
      if (typeof arg1 === 'string') {
        opts = { url: arg1, name };
      } else if (arg1) {
        name = arg1.name;
        onload = arg1.onload;
        opts = objectPick(arg1, [
          'url',
          'headers',
          'timeout',
          'onerror',
          'onprogress',
          'ontimeout',
        ]);
      }
      if (!name || typeof name !== 'string') {
        throw new Error('Required parameter "name" is missing or not a string.');
      }
      Object.assign(opts, {
        context: { name, onload },
        method: 'GET',
        responseType: 'blob',
        overrideMimeType: 'application/octet-stream',
        onload: downloadBlob,
      });
      return onRequestCreate(opts, _uuid);
    }
// end grant apis

var s1 = document.createElement('script');
s1.type = "text/javascript";
s1.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js';
s1.onload = downloadSet
document.body.appendChild(s1);

function downloadSet () {
    'use strict';
    //获取视频下载链接
    function get_mp4(text){
        var re_str = /"mime":"video\/mp4","fps":\S*?,"url":"(\S*?)","cdn":"\S*?","quality":"1080p"/
        var find = text.match(re_str)[1]
        console.log(find)
        return find
    }

    //请求HTML
    function get_find(url){
        GM_xmlHttpRequest({
            method: "GET",
            url: url,
            onload: function(res) {
                console.log("请求HTML成功！")
                if (res.status == 200) {
                    var text = res.responseText;
                    var find = get_mp4(text)

                   // $('sc-uJMKN iJVdiV').after("<button class='sc-gZMcBi deFSmv' style='margin-left: 20px;'><a href='"+find+"' style='color:rgb(248, 249, 250)' target='_blank'>+ Download</a></button>")
                    // $('.clip_info-subline--watch .sc-jhAzac').after("<button class='sc-jhAzac cejtKN' style='margin-left: 20px;'><a href='"+find+"' style='color:rgb(248, 249, 250)' target='_blank'>+ Download</a></button>")
                    $('.js-follow_user_btn').after("<button class='btn js-follow_user_btn btn_sm btn_blue_o topnav_icon_mobile_add_b' style='clear:both;margin-top:-20px;'><a href='"+find+"' target='_blank' class='btn_text'>Download</a></button>")
                    $('button.sc-jqCOkK.gtMnc').after("<button class='sc-jqCOkK gtMnc' style='margin-left: 20px;'><a href='"+find+"' style='color:rgb(248, 249, 250)' target='_blank'>+ Download</a></button>")

                }
            }
        });
    }

    //不判断了，就是干
    function run(){
        var url = $('meta[property="og:video:url"]').attr("content")
        console.log("获取url成功")
        console.log(url)
        //调用获取下载链接函数
        get_find(url)
    }
    //运行脚本
    run()



    // Your code here...
};