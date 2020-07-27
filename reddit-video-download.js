// ==UserScript==
// @name         Reddit video Downloader
// @version      1.0
// @description  Download reddit videos
// @author       1t
// @match        https://www.reddit.com/*
// @match        https://www.reddit.tube/*
// @grant        none
// @run-at       document-end
// @license      GNU General Public License v3.0 or later
// @namespace    https://flowany.com/
// ==/UserScript==

"use strict";
const svg = `<svg t="1595488525799" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="831" width="20" height="20"><path d="M110.804618 551.800471l87.488587 0 0 255.842922-87.488587 0 0-255.842922Z" p-id="832" fill="#ccccca"></path><path d="M824.524876 551.800471l87.488587 0 0 255.842922-87.488587 0 0-255.842922Z" p-id="833" fill="#ccccca"></path><path d="M110.804618 807.643394l801.208844 0 0 87.866187-801.208844 0 0-87.866187Z" p-id="834" fill="#ccccca"></path><path d="M460.757942 90.226954 560.52518 90.226954 560.52518 525.225209 703.58748 383.823736 767.54821 447.784466 511.706311 703.627389 255.863389 447.784466 319.824119 383.823736 462.292901 522.155291Z" p-id="835" fill="#ccccca"></path></svg>`
var ad = function () {
    var nod = document.querySelectorAll('.XPromoPill')
    if (nod.length > 0) {
        nod.forEach(item => item.parentElement.removeChild(item))
    }
    nod = document.querySelectorAll('.XPromoPopup')
    if (nod.length > 0) {
        nod.forEach(item => item.style.display = 'none')
    }
    
}
var mjob = function (current_url) {
    if (current_url.indexOf("https://www.reddit.tube/") != -1) {
        let url = document.referrer;
        let input_url = document.getElementById("url-input");
        input_url.value = url;

        return
    }

    let videoDom = document.querySelectorAll('video')
    if (videoDom.length === 0) videoDom = document.querySelectorAll('.PostContent__playback-action-circle')
    if (videoDom.length > 0) {
        let artic = videoDom[0].closest('article')
        if (!artic.querySelector('.myDownloadDiv')) {
            setDownload( artic.querySelector('footer .PostFooter__vote-and-tools-wrapper') )
        } else {
            artic.querySelector('.myDownloadDiv').style.display = 'block'
        }
    }// else {
       // if (document.getElementById('mydiv')) document.getElementById('mydiv').style.display = 'none'
    //}
}

function setDownload(ato) {
    //console.log('ato', ato)
    // add "download" option.
    const d1 = document.createElement("div");
    //d1.setAttribute('id', 'mydiv')
    d1.className = "PostFooter__dropdown-button PostFooter__hit-area icon myDownloadDiv";
    d1.style.marginBottom = '-3px';
    d1.onclick = function() {
        let url = window.location.href;
        // document.cookie("fau2url=" + url);
        window.open("https://www.reddit.tube/?url=" + url);
    }

    // icon
    d1.innerHTML = svg;
    //const svgElement = d1.querySelector("svg");
    //svgElement.setAttribute("class", "img sx_a5feda");
    //svgElement.style.width = '.95em';
    // append
    // ato.prepend(d1);
    ato.insertBefore(d1, ato.lastChild)
}


var oldurl = window.location.href
mjob(oldurl)
ad()

setInterval(() => {
    ad()
    var cururl = window.location.href
    if (cururl !== oldurl) {
        oldurl = cururl
        mjob(cururl)
    }
}, 1000)
    // let trys = 10
    // let check = setInterval(() => {
    //  trys--
 //        let nod = document.querySelectorAll('.XPromoPill')
 //        if (nod.length > 0) {
    //      clearInterval(check)
 //            nod.forEach(item => item.style.display = 'none')
 //        } else if (trys === 0) {
 //         clearInterval(check)
 //        }
 //    }, 1000)
