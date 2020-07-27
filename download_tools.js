// ==UserScript==
// @name         Downloader
// @version      1.0
// @description  Download Music videos for Youtube and some website
// @author       Bill
// @match        *://*youtube.*
// @match        *://*y2mate.*
// @grant        none
// @run-at       document-end
// @license      GNU General Public License v3.0 or later
// @namespace    https://flowany.com/
// ==/UserScript==


(function () {

	let current_url = window.location.href;
	if (current_url.indexOf("https://www.y2mate.com/") != -1) {
		clickAds.showClickUnderBanner = null;
		let url = document.referrer;
		let input_url = document.getElementById("txt-url");
		input_url.value = url;

		let adInstallAndroid_id = document.getElementById("adInstallAndroid");
		adInstallAndroid_id.style.display="none";
		adInstallAndroid_id.parentNode.removeChild(adInstallAndroid_id);

		let header = document.getElementsByClassName("navbar-header");
		console.log(header);
		header[0].style.display="none";
		header[0].parentNode.removeChild(header[0]);
		return
	}

	"use strict";
	let div = document.createElement('div');
	document.body.appendChild(div);
	div.id = "mydiv";
	div.style.width = "1px";
	div.style.height = "6px";
	div.style.right = "10px";
	div.style.bottom = "10px";
	div.style.color ="#000";
	div.style.position = "fixed";
	div.style.border = "8px solid transparent";
	div.style.borderTop = "8px solid";
	div.style.boxShadow = "0 -12px 0 -4px";
	div.style.background = " linear-gradient(to bottom,#ffffffff 50%,#000000 50%) repeat-x";
	div.style.zIndex = 99999999;
	div.onclick = function() {
		let url = window.location.href;
		// document.cookie("fau2url=" + url);
		window.location.href = "https://www.y2mate.com/en19?url=" + url;
	}
	var drag = new Object();
	drag = {
		opts: function(opt){
			var opts = {
				warp:"", //--method锛宑omponent
			}
			return $.extend(opts, opt, true);
		},
		on: function(opt, callback){ //create
			var _this = this;
			var _opts = _this.opts(opt);
			console.log(_opts.warp);
			var oL,oT,oLeft,oTop;
			var ui = {
				warp: document.querySelector('body'),
				main: _opts.warp,
				currentHeight: _opts.warp.offsetHeight,
				maxW: window.screen.width - _opts.warp.offsetWidth,
				maxH: window.screen.height - _opts.warp.offsetHeight
			}
			ui.main.addEventListener('touchstart', function(e) {
				var ev = e || window.event;
				var touch = ev.targetTouches[0];
				oL = touch.clientX - ui.main.offsetLeft;
				oT = touch.clientY - ui.main.offsetTop;
				window.addEventListener("touchmove", preventDefault, { passive: false });
			})
			ui.main.addEventListener('touchmove', function(e) {
				var _self = this;
				var ev = e || window.event;
				var touch = ev.targetTouches[0];
				oLeft = touch.clientX - oL;
				oTop = touch.clientY - oT;
				oLeft < 0 ? oLeft = 0 : oLeft >= ui.maxW ? oLeft = ui.maxW : '';
				oTop < 0 ? oTop = 0 : oTop >= ui.maxH ? oTop = ui.maxH : '';
				ui.main.style.left = oLeft + 'px';
				ui.main.style.top = oTop + 'px';
				typeof callback == "function" ?  callback({el: _self, type: 'touchmove'}) : '';
			})
			ui.main.addEventListener('touchend', function() {
				var _self = this;
				oLeft > 0 && oLeft < ui.maxW / 2 ? oLeft = 0 : oLeft > ui.maxW / 2 && oLeft < ui.maxW ? oLeft = ui.maxW : '';
				ui.main.style.left = oLeft + 'px';
				ui.main.style.transition = 'left .3s';
				var timer = setTimeout(function(){
					ui.main.style.transition = 'auto';
					clearInterval(timer);
				},300);
				ui.main.style.height = ui.currentHeight + "px";
				ui.main.style.top = oTop + 'px';
	              window.removeEventListener("touchmove", preventDefault);
				typeof callback == "function" ?  callback({el: _self, type: 'touchend'}) : '';
			})
	          function preventDefault(e){
	              e.preventDefault();
	          }
		}
	}

	drag.on({warp:document.querySelector("#mydiv")});

})();