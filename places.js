require('colors');

var crawler = require('crawler');

var database = require('./database.js')

var c = new crawler();

main()

function main() {
    var url = "http://travel.qunar.com/place/"

    console.log('========== 获取资源站点：%s =========='.green.bold, url);

    c.queue({
        uri: url,
        callback: getPlaces
    })
}

function getPlaces(error, res, done) {
    if (error) {
        console.log(error.red);
    } else {
        var $ = res.$
        var $a = $("#js_destination_recommend .listbox .ct li.item a")
        $a.each(function () {
            parsePlaces($(this))
        })
    }
    done();
}

function parsePlaces($this) {
    var text = $this.text().replace("旅游攻略", "")
    var url = $this.attr("href")
    var mate = url.split("-");

    var item = {
        Id: mate[1].substr(2),
        Name: text,
        Url: url,
        Code: mate[2],
        Type: mate[1].substr(0, 2)
    }

    if (item.Type == "gj" || item.Type == "cs") {
        c.queue({
            item: item,
            uri: url + "-zhinan",
            callback: getPlaceInfo
        })
    }
}

function getPlaceInfo(error, res, done) {
    var item = res.options.item

    if (error) {
        database.save_places(item)

        console.error("链接：%s 分析出错！".red, item.Url)
    }

    var $ = res.$

    parsePlaceInfo($, item)

    database.save_places(item)

    console.log("链接：%s 分析完成！".green, item.Url)

    // 如果是国家，获取国家城市
    if (item.Type == "gj" && item.Name != "中国") {
        var $a = $($("#placebottomNav .line")[1]).find("a")
        if ($a.length > 0) {
            $a.each(function () {
                parsePlaces($(this))
            })
        }
    }

    done()
}

function parsePlaceInfo($, item) {
    var $items = $($(".tit_2"))

    for (var i = 0; i < $items.length; i++) {
        var $item = $($items[i])
        var title = $item.text().trim()
        var $cont = $($items[i]).next()
        var cont = unescape($cont.html().replace(/&#x/g, '%u').replace(/;/g, ''))
        if (title == '概述') {
            item.GaiShu = $cont.text()
        } else if (title == '环境') {
            item.HuanJing = cont
        } else if (title == '美食') {
            item.MeiShi = cont
        } else if (title == '热门体验') {
            item.TiYan = cont
        } else if (title == '购物和特产') {
            item.GouWu = cont
        } else if (title == '消费水平') {
            item.XiaoFei = cont
        } else if (title == '最佳出游时间') {
            item.ChuYouShiJian = cont
        } else if (title == '建议游玩天数') {
            item.YouWanTianShu = cont
        } else if (title == '当地节庆') {
            item.DangDiJieQin = cont
        } else if (title == '到达与离开') {
            item.DaoDaYuLiKai = cont
        } else if (title == '当地交通') {
            item.DangDiJiaoTong = cont
        } else if (title == '交通卡、扫码乘车') {
            item.GongJiaoKa = cont
        } else if (title == '紧急求助') {
            item.JinJiQiuZhu = cont
        } else if (title == '旅游注意事项') {
            item.ZhuYiShiXiang = cont
        } else if (title == '医疗服务') {
            item.YiLiaoFuWu = cont
        } else if (title == '实用网站') {
            item.ShiYongWangZhan = cont
        } else if (title == '旅游信息') {
            item.LvYouXinXi = cont
        }
    }

    item.Description = $(".desc").text()
}