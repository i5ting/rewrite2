// "use strict";
const http = require("http");
const url = require("url");
const rewrite2 = require(".");

module.exports = function(config) {
  return http.createServer((req, res) => {
    var path = url.parse(req.url).pathname;
    if (config[path]) {
      rewrite2.proxy(req, res, config[path]);
    } else {
      let error = {
        msg: "not match!!"
      };
      res.end(JSON.stringify(config.error || error));
    }
  });
};
