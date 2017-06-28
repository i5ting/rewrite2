// "use strict";
const http = require("http");
const url = require("url");

const rewrite2 = require(".");
const config = require("./test/config");

http
  .createServer((req, res) => {
    var path = url.parse(req.url).pathname
    if (config[path]) {
      rewrite2.proxy(req, res, config[path]);
    }else{
      res.end(JSON.stringify({
        'msg': "not match!!"
      }))
    }
  })
  .listen(3000, "127.0.0.1");

console.log("Server running at http://127.0.0.1:3000/");
