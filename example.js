// "use strict";
const rewrite2 = require(".");
const config = require("./test/config");

rewrite2.server(config).listen(3000, "127.0.0.1");

console.log("Server running at http://127.0.0.1:3000/");
