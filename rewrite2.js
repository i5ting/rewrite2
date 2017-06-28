const rewrite2 = require(".");
const extend = require("xtend");

module.exports = function (req, res, config) {
    let _config = extend({
        jsonp: true
    }, config)

    rewrite2(req, res, _config);
}
