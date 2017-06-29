const Rewrite = require("./rewrite")
const extend = require("xtend")

exports.proxy = function (req, res, config) {
    return new Rewrite(req, res, config).start()
}

exports.jsonp_proxy = function (req, res, config) {
    let _config = extend({
        jsonp: true
    }, config)

    return new Rewrite(req, res, _config).start()
}

exports.server = require('./server')
