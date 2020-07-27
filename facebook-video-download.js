// ==UserScript==
// @name         Facebook video Downloader
// @version      1.0
// @description  Download facebook videos
// @author       1t
// @match        https://m.facebook.com/*
// @match        https://www.getfvid.com/*
// @grant        none
// @run-at       document-end
// @license      GNU General Public License v3.0 or later
// @namespace    https://flowany.com/
// ==/UserScript==


"use strict";
const svg = `<svg t="1595426763760" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2098" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24"><path d="M810.667 554.667l0 213.333-597.333 0 0-213.333-85.333 0 0 298.667 768 0 0-298.667z" p-id="2099"></path><path d="M512 682.667l170.667-213.333-128 0 0-298.667-85.333 0 0 298.667-128 0z" p-id="2100"></path></svg>`;
let videoNums = 0
window.addEventListener('load', ()=>{
    videoNums = document.querySelectorAll('[data-sigil="inlineVideo"]').length
    initDownload()
})
window.addEventListener('scroll', () => {
    let tempNums = document.querySelectorAll('[data-sigil="inlineVideo"]').length
    if (tempNums !== videoNums) {
        videoNums = tempNums
        initDownload()
    }
})

function initDownload () {
    document.querySelectorAll('[data-sigil="inlineVideo"]').forEach(item => {
        let wrap = item.closest('article') || item.closest('[data-sigil="story-div story-popup-metadata story-popup-metadata feed-ufi-metadata"]')
        if (wrap.querySelectorAll('.downloadBtn').length === 0) {
            //console.log(item)
            let data = item.getAttribute('data-store')
            data = JSON.parse(data)
            //console.log(data)
            //setTimeout(() => {
            //console.log(item)
            // let story = wrap.querySelector('.story_body_container')
            let header = wrap.querySelector('header._77kd')
            // console.log('header', header)
            let titleDom = header.querySelector('._4g34 ._5xu4 ._7om2 ._4g34')
            // console.log('titleDom',titleDom)
            setDownload(titleDom, data.src)
            //},1000)
        }
    })
}

function setDownload(titleDom, url) {
    // add "download" option.
    const d1 = document.createElement("div");
    d1.className = "_5s61 _2pis downloadBtn";
    //d1.style.marginRight = '16px';

    const d2 = document.createElement("div");
    d2.className = "_yff";

    const d3 = document.createElement("a");
    d3.className = "_4s19 sec";
    d3.setAttribute('href', url)
    d3.setAttribute('target', '_blank')
    d3.setAttribute('role', 'button')
    d3.setAttribute('data-sigil', 'touchable')

    // icon
    d2.innerHTML = svg;
    const svgElement = d2.querySelector("svg");
    svgElement.setAttribute("class", "img sx_a5feda");
    //svgElement.style.width = '.95em';
    // append
    d2.insertBefore(d3, svgElement)
    d1.appendChild(d2)
    titleDom.parentElement.insertBefore(d1, titleDom.nextSibling);
}

