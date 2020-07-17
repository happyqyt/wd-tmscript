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

(function() {
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
        GM_xmlhttpRequest({
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
})();