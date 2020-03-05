var mysql = require('mysql');

// 创建数据库连接池
var pool = mysql.createPool({
    host: 'localhost', // 数据库地址
    user: 'root', // 数据库用户
    password: '1234', // 对应的密码
    database: 'qunar', // 数据库名称
    connectionLimit: 100 // 最大连接数，默认为10
});

var insert_places_sql = 'INSERT INTO `qunar`.`places` (`Id`,`Name`,`Url`,`Code`,`Type`,`Description`,`GaiShu`,`HuanJing`,`MeiShi`,`TiYan`,`GouWu`,`XiaoFei`,`ChuYouShiJian`,`YouWanTianShu`,`DangDiJieQin`,`DaoDaYuLiKai`,`DangDiJiaoTong`,`GongJiaoKa`,`JinJiQiuZhu`,`ZhuYiShiXiang`,`YiLiaoFuWu`,`ShiYongWangZhan`,`LvYouXinXi`, `Error`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
var find_places_sql = 'SELECT * FROM `qunar`.`places` WHERE Id = ?'
var update_places_sql = 'UPDATE `qunar`.`places` SET `Description`=?,`GaiShu`=?,`HuanJing`=?,`MeiShi`=?,`TiYan`=?,`GouWu`=?,`XiaoFei`=?,`ChuYouShiJian`=?,`YouWanTianShu`=?,`DangDiJieQin`=?,`DaoDaYuLiKai`=?,`DangDiJiaoTong`=?,`GongJiaoKa`=?,`JinJiQiuZhu`=?,`ZhuYiShiXiang`=?,`YiLiaoFuWu`=?,`ShiYongWangZhan`=?,`LvYouXinXi`=?, `Error`=? WHERE Id = ?';

function save_places(item) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query(find_places_sql, [item.Id], function (err, result) {
            if (err) {
                console.log('[FIND ERROR] - ', err.message);
            }

            if (result && result.length == 0) {
                connection.query(insert_places_sql, [item.Id, item.Name, item.Url, item.Code, item.Type, item.Description, item.GaiShu, item.HuanJing, item.MeiShi, item.TiYan, item.GouWu, item.XiaoFei, item.ChuYouShiJian, item.YouWanTianShu, item.DangDiJieQin, item.DaoDaYuLiKai, item.DangDiJiaoTong, item.GongJiaoKa, item.JinJiQiuZhu, item.ZhuYiShiXiang, item.YiLiaoFuWu, item.ShiYongWangZhan, item.LvYouXinXi, item.Error], function (err, result) {
                    if (err) {
                        console.log('[INSERT ERROR] - ', err.message);
                    }
                });
            } else {
                connection.query(update_places_sql, [item.Description, item.GaiShu, item.HuanJing, item.MeiShi, item.TiYan, item.GouWu, item.XiaoFei, item.ChuYouShiJian, item.YouWanTianShu, item.DangDiJieQin, item.DaoDaYuLiKai, item.DangDiJiaoTong, item.GongJiaoKa, item.JinJiQiuZhu, item.ZhuYiShiXiang, item.YiLiaoFuWu, item.ShiYongWangZhan, item.LvYouXinXi, null, item.Id], function (err, result) {
                    if (err) {
                        console.log('[UPDATE ERROR] - ', err.message);
                    }
                });
            }
        })

        connection.release();
    });
}

exports.save_places = save_places

function get_cities(callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query("SELECT `Id`,`Name`,`Url`,`Code`,`Type` FROM places WHERE TYPE = 'cs' And OK = FALSE  ORDER BY Id", function (err, result) {
            if (err) {
                console.error(err)
            }
            callback(result)
        })

        connection.release();
    });
}

exports.get_cities = get_cities

function get_city(callback) {
    get_cities(function (result) {
        if (result && result.length > 0) {
            callback(result[0])
        }
    })
}

exports.get_city = get_city

function next_city(cur_city, callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query("UPDATE places SET ok = TRUE, Error =? WHERE Id =?", [cur_city.Error, cur_city.Id], function (err, result) {
            if (err) {
                console.error(err)
            }

            get_city(callback)
        })

        connection.release();
    });
}

exports.next_city = next_city

var insert_points_sql = 'INSERT INTO `qunar`.`points` (`Id`, `Url`, `Photo`, `ENName`, `CNName`, `Description`, `Lat`, `Lng`, `Location`, `Score`, `Summary`, `Address`, `Phone`, `Website`, `OpenHours`, `Ticket`, `BestTime`, `Traffic`, `Tips`, `Error`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
var find_points_sql = 'SELECT * FROM `qunar`.`points` WHERE Id = ?'
var update_points_sql = 'UPDATE `qunar`.`points` SET `Location`=?, `Score`=?, `Summary`=?, `Address`=?, `Phone`=?, `Website`=?, `OpenHours`=?, `Ticket`=?, `BestTime`=?, `Traffic`=?, `Tips`=?, `Error`=? WHERE Id =?'

function save_points(item) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query(find_points_sql, [item.Id], function (err, result) {
            if (err) {
                console.log('[FIND ERROR] - ', err.message);
            }

            if (result && result.length == 0) {
                connection.query(insert_points_sql, [item.Id, item.Url, item.Photo, item.ENName, item.CNName, item.Description, item.Lat, item.Lng, item.Location, item.Score, item.Summary, item.Address, item.Phone, item.Website, item.OpenHours, item.Ticket, item.BestTime, item.Traffic, item.Tips, item.Error], function (err, result) {
                    if (err) {
                        console.log('[INSERT ERROR] - ', err.message);
                    }
                });
            } else {
                connection.query(update_points_sql, [item.Location, item.Score, item.Summary, item.Address, item.Phone, item.Website, item.OpenHours, item.Ticket, item.BestTime, item.Traffic, item.Tips, null, item.Id], function (err, result) {
                    if (err) {
                        console.log('[UPDATE ERROR] - ', err.message);
                    }
                });
            }
        })

        connection.release();
    });
}

exports.save_points = save_points

function get_points(page_index, skip_count, callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        var size = 25
        var offset = (page_index - 1) * size + skip_count

        connection.query("SELECT * FROM points WHERE Location = '' OR Location IS NULL ORDER BY Id LIMIT ?,? ", [offset, size], function (err, result) {
            if (err) {
                console.error(err)
            }
            callback(result)
        })

        connection.release();
    });
}

exports.get_points = get_points