"use strict";

const http = require("http");
const url = require("url");
const qs = require("qs");
const rewrite2 = require("..");

module.exports = function(config) {
  return http.createServer((req, res) => {
    let path = url.parse(req.url).pathname;
    let querystring = url.parse(req.url).query;

    req.query = qs.parse(querystring);

    if (path === '/json') {
      // /jsonp?url=http://httpbin.org/ip&
      rewrite2.proxy(req, res, {
        url: req.query.url,
        method: req.query.method || 'get'
      });
    } else if (path === '/jsonp') {
      // /jsonp?url=http://httpbin.org/ip&method=post
      rewrite2.jsonp_proxy(req, res, {
        url: req.query.url,
        method: req.query.method || 'get'
      });
    } else if (config[path]) {
      rewrite2.proxy(req, res, config[path]);
    } else {
      let error = {
        msg: "not match!!"
      };
      res.end(JSON.stringify(config.error || error));
    }
  });
};

function name(params) {
  
}