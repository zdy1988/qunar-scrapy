require('colors');

var crawler = require('crawler');
var async = require('async');
var program = require('commander');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var userHome = require('user-home');

var database = require('./database')
var proxy = require('./proxy')

const version = require('./package.json').version;

program
    .version(version)
    .usage('[options]')
    .option('-m, --mode <string>', '设置是否进入景点信息补全模式', 'normal')
    .option('-p, --parallel <num>', '设置抓取并发连接数，默认值：5', 5)
    .option('-i, --index <num>', '设置起始页数，默认值：1', 1)
    .option('-r, --retry <num>', '设置重试次数，默认值：5', 5)
    .option('-t, --timeout <num>', '自定义连接超时时间(毫秒)。默认值：30000毫秒', 30000)
    .option('-o, --output <file_path>', '设置图片抓取结果的保存位置，默认为当前用户的主目录下的 magnets 文件夹', path.join('D:\\Magnets\\', 'qunar'))
    .option('-x, --proxy', '设置使用代理')
    .parse(process.argv);

var mode = program.mode
var parallel = parseInt(program.parallel);
var page_index = parseInt(program.index);
var retries = parseInt(program.retry);
var timeout = parseInt(program.timeout);
var output = program.output.replace(/['"]/g, '');
var use_proxy = program.proxy || false

var proxy_path = null;
var proxy_limited = false

mkdirp.sync(output);

var c = new crawler({
    rateLimit: 1000,
    retries: retries,
    retryTimeout: timeout
});

c.on('schedule', function (options) {
    if (use_proxy && proxy_path) {
        options.proxy = proxy_path
    }
});

var cur_loop_city = ""
var loop_list_url = ""
var cur_loop_list = []
// 设置最大页数为10000，是因为在自定义随意page_index时需要进行运行，之后下载列表页后再更新成确定的值
var max_page_index_default = 10000
var max_page_index = max_page_index_default

main()

function main() {
    console.log('========== 开始获取资源 =========='.green.bold)
    console.log('并行连接数：'.green, parallel.toString().green.bold);
    console.log('连接超时设置：'.green, (timeout / 1000.0).toString().green.bold, '秒'.green)

    if (mode == 'normal') {
        console.log('========== 获取城市信息 =========='.green.bold)
        database.get_city(loop_city)
    } else {
        console.log('========== 获取景点资源 =========='.green.bold)
        loop_points_start();
    }
}

function loop_city(result) {
    if (result) {
        cur_loop_city = result
        var name = cur_loop_city.Name
        loop_list_url = cur_loop_city.Url + "-jingdian"
        console.log('===== 获取城市信息成功，即将获取城市 %s 的信息 ====='.green, name.yellow.bold.inverse)

        loop_start();
    }
}

function loop_start() {
    async.during(
        loop_list,
        loop_list_item,
        loop_list_error);
}

function loop_list(callback) {
    if (page_index > max_page_index) {
        return callback("next_page", false);
    }

    // 如果使用的代理被限制更换代理
    if (use_proxy && proxy_limited) {
        console.log("========== 代理被限制，即将更换代理 ==========".red.bold)
        return callback("proxy_limited", false);
    }

    var url = loop_list_url + (page_index === 1 ? '' : ('-1-' + page_index));

    c.queue({
        uri: url,
        callback: function (error, res, done) {
            if (error) {
                done();
                return callback(error, false);
            }

            if (res.statusCode == 404) {
                cur_loop_city.Error = res.statusMessage
                console.error("链接：%s 页面未找到,更换下一城市...", url.yellow.bold)
                done()
                return callback("next_page", false);
            }

            var $ = res.$;

            if (max_page_index == 10000) {
                console.log('========== 获取城市列表页数 =========='.green)

                if ($(".b_paging").html() == "") {
                    max_page_index = 1
                } else {
                    var num = 1
                    if ($(".b_paging a.next").length > 0) {
                        var num = $(".b_paging a.next").prev().text()
                    } else {
                        var num = $(".b_paging .page").last().text()
                    }
                    max_page_index = parseInt(num)
                }

                console.log('========== 此次最大页数为:%d =========='.green, max_page_index)
            }

            console.log('开始分析第' + page_index + '页列表链接: %s'.green, url.yellow.inverse);

            var $li = $(".b_scenic_spots_new .listbox .list_item li")

            var items = []

            for (var i = 0; i < $li.length; i++) {
                var li = $li[i]
                var item = {}
                item.Url = $(li).find(".imglink").attr("href")
                item.Id = item.Url.split("-")[1].substr(2)
                item.Photo = $(li).find(".imglink").find("img").attr("src")
                item.ENName = $(li).find(".en_tit").text()
                item.CNName = $(li).find(".cn_tit").text().replace(item.ENName, "")
                item.Description = $(li).find(".desbox").text()
                item.Lat = $(li).attr("data-lat")
                item.Lng = $(li).attr("data-lng")
                items.push(item)
            }

            console.log('第' + page_index + '页分析列表完毕: %s'.blue, url.yellow.inverse);

            cur_loop_list = items

            done();

            callback(null, true);
        }
    })
}

function loop_list_error(error) {
    if (error) {
        if (typeof (error) == "string" && error == 'next_page') {
            console.log("========== 等待 5 秒后更换下一个城市 ==========".green)
            setTimeout(function () {
                console.log("========== 已经等待5秒，准备下一城市".blue)
                page_index = 1
                max_page_index = max_page_index_default
                database.next_city(cur_loop_city, loop_city)
            }, 5000)
        } else if (typeof (error) == "string" && error == 'proxy_limited') {
            console.log('========== 等待 5 秒换下一个代理 =========='.green);
            setTimeout(function () {
                console.log("========== 已经等待5秒, 获取代理... ==========".green.bold)
                proxy.get_proxy(function (uri) {
                    if (uri) {
                        proxy_path = uri
                        proxy_limited = false
                        main()
                    } else {
                        console.error("========== 代理获取失败，退出程序... ==========".red.bold)
                        return process.exit(1);
                    }
                })
            }, 10000)
        } else if (typeof (error.message) == "string" && error.message.toLowerCase().indexOf("timeout") != -1) {
            console.log('抓取过程超过重试次数，等待 60 秒后再次重试');
            setTimeout(function () {
                console.log('已经等待60秒，准备开始...')
                main()
            }, 60000)
        } else {
            console.log('抓取过程终止：%s', error.message);
            return process.exit(1);
        }
    } else {
        return process.exit(0); // 退出当前
    }
}

function loop_list_item(callback) {
    async.waterfall(
        [loop_list_item_image, loop_list_item_page],
        function (err) {
            page_index++;
            if (err) return callback(err);
            return callback(null);
        })
}

function loop_list_item_image(next) {
    console.log('===== 即将下载第%d页图片 ====='.green, page_index);

    async.forEachOfLimit(
        cur_loop_list,
        parallel,
        loop_list_item_image_download,
        function (err) {
            if (err) console.log(err);

            console.log('===== 第%d页图片下载完毕 ====='.blue, page_index);
            console.log();
            return next();
        }
    )
}

function loop_list_item_image_download(item, index, callback) {
    mkdirp.sync(output);

    var fileFullPath = path.join(output, item.Id + '.jpg');

    fs.access(fileFullPath, fs.F_OK, function (err) {
        if (err) {
            c.queue([{
                uri: item.Photo,
                encoding: null,
                jQuery: false, // set false to suppress warning message.
                callback: function (err, res, done) {
                    if (err) {
                        console.error(('[' + item.CNName + ']').red.bold.inverse + '[图片]'.yellow.inverse, err.message.red);
                    } else {
                        fs.createWriteStream(fileFullPath).write(res.body);
                        console.error(('[' + item.CNName + ']').green.bold.inverse + '[图片]'.yellow.inverse, fileFullPath);
                    }
                    done();
                    callback();
                }
            }])
        } else {
            console.log(('[' + item.CNName + ']').green.bold.inverse + '[图片]'.yellow.inverse, 'file already exists, skip!'.yellow);
            callback();
        }
    })
}

function loop_list_item_page(next) {
    console.log('===== 即将分析第%d页数据 ====='.green, page_index);

    async.forEachOfLimit(
        cur_loop_list,
        parallel,
        loop_list_item_page_download,
        function (err) {
            if (err) console.log(err);

            console.log('===== 第%d页数据处理完毕 ====='.blue, page_index);
            console.log();
            return next();
        }
    )
}

function loop_list_item_page_download(item, index, callback) {
    // 保存item数据
    database.save_points(item)

    // 暂时不抓内容
    // 没有代理的时候，访问内容太多会被封IP
    if (!use_proxy) {
        return callback();
    }

    // 抓取内容
    c.queue([{
        uri: item.Url,
        callback: function (error, res, done) {
            //分析内容
            console.log('分析内容页面: %s'.green, item.Url.green.bold);

            if (error) {
                console.error(('[' + item.CNName + ']').red.bold.inverse + ' ' + err.message.red);

                //保存错误数据，以后再说
                item.Error = error.message
                database.save_points(item);

                done();
                return callback();
            }

            var $ = res.$;

            // IP被限制，换代理
            if (use_proxy) {
                if ($("body").text().indexOf("IP访问频率过高") != -1) {
                    proxy_limited = true
                    done();
                    return callback();
                }
            }

            // 位置
            var location = []
            var $crumbs = $(".e_crumbs .item .txtlink")
            for (var i = 0; i < $crumbs.length; i++) {
                var crumb = $($crumbs[i]).text().trim()
                location.push(crumb)
            }
            item.Location = location.join(">")

            //分数
            item.Score = $(".scorebox .cur_score").text()

            //介绍
            var summary = $("#gs .e_db_content_box").html()
            if (typeof summary == 'string' && summary.length > 0) {
                item.Summary = unescape(summary.replace(/&#x/g, '%u').replace(/;/g, ''))
            }

            //其他
            var $dl = $("#gs .e_summary_list dl")
            for (var i = 0; i < $dl.length; i++) {
                var dl = $($dl[i]);

                var name = $(dl).find("dt").text().trim()
                var value = $(dl).find("dd").text().trim()

                if (name == "地址:") {
                    item.Address = value
                } else if (name == "电话:") {
                    item.Phone = value
                } else if (name == "官网:") {
                    item.Website = value
                } else if (name == "开放时间:") {
                    item.OpenHours = value
                }
            }

            //门票
            item.Ticket = $("#mp .e_db_content_box").text()

            //旅游时节
            item.BestTime = $("#lysj .e_db_content_box").text()

            //交通指南
            var traffic = $("#jtzn .e_db_content_box").html()
            if (typeof traffic == 'string' && traffic.length > 0) {
                item.Traffic = unescape(traffic.replace(/&#x/g, '%u').replace(/;/g, ''))
            }

            //小贴士
            var tips = $("#ts .e_db_content_box").html()
            if (typeof tips == 'string' && tips.length > 0) {
                item.Tips = unescape(tips.replace(/&#x/g, '%u').replace(/;/g, ''))
            }

            // 保存分析后得数据
            database.save_points(item)

            done();

            //旅游导图
            var $imgs = $("#lydt img")
            if ($imgs.length > 0) {
                var imgLinks = []
                for (var i = 0; i < $imgs.length; i++) {
                    imgLinks.push({
                        Src: $($imgs[i]).attr("src"),
                        Id: item.Id
                    })
                }
                loop_list_item_page_image(item, imgLinks, callback);
            } else {
                callback();
            }
        }
    }])
}

function loop_list_item_page_image(item, imgLinks, callback) {
    console.log('===== 即将下载 %s 图片数据 ====='.green, item.CNName.yellow.inverse);

    async.forEachOfLimit(
        imgLinks,
        parallel,
        loop_list_item_page_image_download,
        function (err) {
            if (err) console.log(err);

            console.log('===== %s 图片数据下载完毕 ====='.blue, item.CNName.yellow.inverse);
            console.log();
            return callback();
        }
    )
}

function loop_list_item_page_image_download(item, index, callback) {
    var c_output = path.join(output, item.Id)

    mkdirp.sync(c_output);

    var fileFullPath = path.join(c_output, index + '.jpg');

    fs.access(fileFullPath, fs.F_OK, function (err) {
        if (err) {
            c.queue([{
                uri: item.Src,
                encoding: null,
                jQuery: false, // set false to suppress warning message.
                callback: function (err, res, done) {
                    if (err) {
                        console.error(('[' + item.Id + '-' + index + ']').red.bold.inverse + '[图片]'.yellow.inverse, err.message.red);
                    } else {
                        fs.createWriteStream(fileFullPath).write(res.body);
                        console.error(('[' + item.Id + '-' + index + ']').green.bold.inverse + '[图片]'.yellow.inverse, fileFullPath);
                    }
                    done();
                    callback();
                }
            }])
        } else {
            console.log(('[' + item.Id + '-' + index + ']').green.bold.inverse + '[图片]'.yellow.inverse, 'file already exists, skip!'.yellow);
            callback();
        }
    })
}

// =======================================================================================
// ==============================抓没有抓成功的景点信息=====================================
// =======================================================================================
// =======================================================================================

function loop_points_start() {
    async.during(
        loop_points_list,
        loop_points_list_item,
        loop_list_error);
}

function loop_points_list(callback) {
    // 如果使用的代理被限制更换代理
    if (use_proxy && proxy_limited) {
        console.log("========== 代理被限制，即将更换代理 ==========".red.bold)
        return callback("proxy_limited", false);
    }

    database.get_points(page_index, function (result) {
        if (result && result.length > 0) {
            cur_loop_list = result
            callback(null, true)
        } else {
            return callback(null, false);
        }
    })
}

function loop_points_list_item(callback) {
    async.waterfall(
        [loop_list_item_page],
        function (err) {
            page_index++;
            if (err) return callback(err);
            return callback(null);
        })
}