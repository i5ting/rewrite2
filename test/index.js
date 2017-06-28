import test from "ava";
const fs = require("fs");
const url = require("url");
const got = require("got");
const http = require("http");
const rewrite2 = require("..");
const config = require("./config");

test.before(t => {
  // This runs before all tests
  http
    .createServer((req, res) => {
      var path = url.parse(req.url).pathname;
      if (config[path]) {
        rewrite2.proxy(req, res, config[path]);
      } else {
        res.end(
          JSON.stringify({
            msg: "not match!!"
          })
        );
      }
    })
    .listen(3000, "127.0.0.1");

  http
    .createServer((req, res) => {
      var path = url.parse(req.url).pathname;
      if (path == "/port") {
        res.end("port");
      } else {
        res.end(
          JSON.stringify({
            msg: "not match!!"
          })
        );
      }
    })
    .listen(3002, "127.0.0.1");
});

test("url", t => {
  return got("http://127.0.0.1:3000/url", { json: true })
    .then(response => {
      t.is(response.body.now.slang_time, "now");
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("url2", t => {
  return got("http://127.0.0.1:3000/url2", { json: true })
    .then(response => {
      console.log(response.body);
      t.is(response.body.now.slang_time, "now");
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("post", t => {
  return got("http://127.0.0.1:3000/post")
    .then(response => {
      let json = JSON.parse(response.body);

      t.is(json.url, "http://httpbin.org/post");
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("ip", t => {
  return got("http://127.0.0.1:3000/ip", { json: true })
    .then(res => {
      t.true(res.body.origin.length > 0);
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("ip2", t => {
  return got("http://127.0.0.1:3000/ip2", { json: true })
    .then(res => {
      //  console.log(res.body);
      t.true(res.body.origin.length > 0);
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("port", t => {
  return got("http://127.0.0.1:3000/port")
    .then(res => {
      //  console.log(res.body);
      t.true(res.body == "port");
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("qs", t => {
  return got("http://127.0.0.1:3000/qs?a=1#hash", { json: true })
    .then(res => {
      //    console.dir(res.body);
      t.true(res.body.args.a == 1);
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test("jsonp", t => {
  return got("http://127.0.0.1:3000/jsonp")
    .then(res => {
      //   console.log(res.body);
      t.regex(res.body, /callback/);
    })
    .catch(error => {
      console.log(error);
      //=> 'Internal server error ...'
    });
});

test("jsonp with custom callback", t => {
  return got("http://127.0.0.1:3000/jsonp?callback=cb")
    .then(res => {
      //   console.log(res.body);
      t.regex(res.body, /cb/);
    })
    .catch(error => {
      console.log(error);
      //=> 'Internal server error ...'
    });
});

test("bodystring", t => {
  return got("http://127.0.0.1:3000/bodystring")
    .then(res => {
      //  console.log(res.body);
      t.true(res.body == "bodystring");
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

test.only("bodyjson", t => {
  return got("http://127.0.0.1:3000/bodyjson", { json: true })
    .then(res => {
       console.dir(res.body);
      t.true(res.body.a == 1);
    })
    .catch(error => {
      console.log(error.response.body);
      //=> 'Internal server error ...'
    });
});

