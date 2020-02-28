//==============================================================
// 这里使用了 jiangxianli/ProxyIpLib 得代理IP
// Github : https://github.com/jiangxianli/ProxyIpLib
// 精选的代理很好用，给他打个广告
//==============================================================



var crawler = require('crawler');

var c = new crawler();

c.on('schedule', function (options) {
    options.proxy = "http://117.88.4.36:3000"
});

function get_proxy(callback) {
    //test
    //return callback("http://117.88.4.36:3000")

    c.queue({
        uri: 'https://www.freeip.top/api/proxy_ip',
        callback: function (error, res, done) {
            if (error) {
                console.log('========== 获取代理IP失败 ==========')
                console.log(error)
                callback()
            } else {
                var json = JSON.parse(res.body)
                if (json && json.msg == '成功') {
                    var proxy = json.data.protocol + "://" + json.data.ip + ":" + json.data.port
                    console.log('========== 获取代理IP成功：%s ==========', proxy)
                    callback(proxy)
                } else {
                    callback()
                }
            }

            done();
        }
    })
}

exports.get_proxy = get_proxy