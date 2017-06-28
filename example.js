// "use strict";
const http = require("http");
const url = require("url");

const rewrite2 = require(".");
const config = require("./test/config");

console.log(config)

rewrite2.server(config).listen(3000, "127.0.0.1");

console.log("Server running at http://127.0.0.1:3000/");
