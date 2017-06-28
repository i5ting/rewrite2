const rewrite2 = require("./rewrite2")
const extend = require("xtend")

exports.proxy = function (req, res, config) {
    rewrite2(req, res, config)
}

exports.jsonp_proxy = function (req, res, config) {
    let _config = extend({
        jsonp: true
    }, config)

    rewrite2(req, res, _config)
}

exports.server = require('./server')