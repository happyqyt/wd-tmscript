// ==UserScript==
// @name         Instagram video Downloader
// @version      1.0
// @description  Download instagram videos
// @author       1t
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-end
// @license      GNU General Public License v3.0 or later
// @namespace    https://flowany.com/
// ==/UserScript==


"use strict";
const svg = `<svg t="1595426763760" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2098" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24"><path d="M810.667 554.667l0 213.333-597.333 0 0-213.333-85.333 0 0 298.667 768 0 0-298.667z" p-id="2099"></path><path d="M512 682.667l170.667-213.333-128 0 0-298.667-85.333 0 0 298.667-128 0z" p-id="2100"></path></svg>`;
let videoNums = 0
window.addEventListener('load', ()=>{
    videoNums = document.querySelectorAll('video').length
    initDownload()
})
window.addEventListener('scroll', () => {
    let tempNums = document.querySelectorAll('video').length
    if (tempNums !== videoNums) {
        videoNums = tempNums
        initDownload()
    }
})

function initDownload () {
    document.querySelectorAll('video').forEach(item => {
        let wrap = item.closest('article')
        if (wrap.querySelectorAll('.downloadBtn').length === 0) {
            //console.log(item)
            let url = item.getAttribute('src')
            //console.log(url)
            let header = wrap.querySelector('header')
            setDownload(header, url)
        }
    })
}

function setDownload(header, url) {
    // add "download" option.
    const d1 = document.createElement("div");
    d1.className = "downloadBtn";
    //d1.style.marginRight = '16px';

    const d2 = document.createElement("a");
    d2.setAttribute('href', url)
    d2.setAttribute('target', '_blank')
    d2.setAttribute('role', 'button')

    // icon
    d2.innerHTML = svg;
    d1.appendChild(d2)
    header.append(d1);
}
