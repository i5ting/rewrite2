var http = require("http"),
  https = require("https"),
  extend = require("xtend"),
  net = require("net"),
  jsonp = require("jsonp-body"),
  qs = require("qs"),
  fs = require("fs"), // no use
  url = require("url"),
  pathUtil = require("path"), // no use
  zlib = require("zlib"),
  color = require("colorful"),
  Buffer = require("buffer").Buffer,
  util = require("./util"),
  Stream = require("stream"),
  logUtil = require("./log"),
  ThrottleGroup = require("stream-throttle").ThrottleGroup;

// to fix issue with TLS cache, refer to: https://github.com/nodejs/node/issues/8368
https.globalAgent.maxCachedSessions = 0;

module.exports = class Rewrite {
  constructor(req, userRes, config) {
    this.req = req;
    this.userRes = userRes;
    this.config = config;

    if (typeof config === "string") this.config = { url: config };
    let querystring = url.parse(req.url).query;
    this.req.query = qs.parse(querystring);
    this.reqData = undefined;
    /*
    note
        req.url is wired
        in http  server : http://www.example.com/a/b/c
        in https server : /a/b/c
    */

    var host = req.headers.host;
    var protocol =
        !!req.connection.encrypted && !/^http:/.test(req.url)
          ? "https"
          : "http",
      //fullUrl = protocol === "http" ? req.url : protocol + "://" + host + req.url,
      fullUrl = config.url
        ? config.url + (querystring ? "?" + querystring : "")
        : protocol + "://" + host + req.url,
      resourceInfo,
      resourceInfoId = -1;

    this.urlPattern = url.parse(fullUrl);
    this.path = this.urlPattern.path;
    this.protocol = protocol;

    if (this.urlPattern.query) this.urlPattern.query = querystring;

    if (config.host) {
      this.urlPattern.host = config.host;
      var arr = config.host.split(":");
      this.urlPattern.hostname = arr[0];
      this.urlPattern.port = arr.length === 1 ? 80 : arr[1];
    }

    if (config.hostname) {
      this.urlPattern.hostname = config.hostname;
      this.urlPattern.host =
        this.urlPattern.hostname + ":" + this.urlPattern.port;
    }

    if (config.port) {
      this.urlPattern.port = config.port;
      this.urlPattern.host =
        this.urlPattern.hostname + ":" + this.urlPattern.port;
    }

    if (config.path) {
      this.urlPattern.path = config.path;
    }

    if (config.pathname) {
      this.urlPattern.pathname = config.pathname;
    }

    if (this.req.headers.host) this.req.headers.host = this.urlPattern.host;
    // console.log(req.url)
    // console.log(path)

    //record
    this.resourceInfo = {
      host: host,
      method: req.method,
      path: this.path,
      protocol: protocol,
      url: protocol + "://" + host + this.path,
      req: req,
      startTime: new Date().getTime()
    };
  }

  start() {
    if (this.config.body) {
      var serverResData = this.config.body;
      if (typeof this.config.body === "string") {
        this.userRes.writeHead(200, {
          "Content-Length": Buffer.byteLength(this.config.body),
          "Content-Type": "text/plain"
        });

        this.userRes.end(this.config.body);
      } else {
        serverResData = JSON.stringify(serverResData);

        // jsonp wrap
        if (this.config.jsonp) {
          serverResData = jsonp(
            JSON.parse(serverResData),
            this.req.query.callback || this.config.jsonp_function || "callback"
          );
        }

        this.userRes.writeHead(200, {
          "Content-Length": Buffer.byteLength(serverResData),
          "Content-Type": "application/json"
        });

        this.userRes.end(serverResData.toString());
      }
    } else {
      this.getReqBody().then(this.dealWithRemoteResonse.bind(this));
    }
  }

  getReqBody() {
    let self = this;
    return new Promise(function(resolve, reject) {
      var postData = [];
      self.req.on("data", function(chunk) {
        postData.push(chunk);
      });
      self.req.on("end", function() {
        self.reqData = Buffer.concat(postData);
        self.resourceInfo.reqBody = self.reqData.toString();

        resolve();
        // global.recorder && global.recorder.updateRecord(resourceInfoId,resourceInfo)
      });
    });
  }

  dealWithRemoteResonse() {
    var options;
    var self = this;

    //modify request protocol
    // protocol = userRule.replaceRequestProtocol(req, protocol) || protocol

    //modify request options
    var defaultOptions = {
      hostname: this.urlPattern.hostname || this.req.headers.host,
      port:
        this.urlPattern.port ||
        this.req.port ||
        (/https/.test(this.protocol) ? 443 : 80),
      path: this.path,
      method: this.req.method,
      headers: this.req.headers,
      jsonp: false,
      jsonp_function: this.req.query.callback || "callback",
      filter: function(options) {}
    };

    var options = extend(defaultOptions, this.config);

    // 赋值后，仍然可以通过此方法修改request options
    if (this.config.filter) options = this.config.filter(options);

    // options = userRule.replaceRequestOption(req, options) || options
    options.rejectUnauthorized = false;
    try {
      delete options.headers["accept-encoding"]; //avoid gzipped response
    } catch (e) {}

    //update request data
    // reqData = userRule.replaceRequestData(req, reqData) || reqData
    options.headers = util.lower_keys(options.headers);

    // options.headers["content-length"] = reqData.length //rewrite content length info

    options.headers = util.upper_keys(options.headers);

    //send request
    var proxyReq = (/https/.test(this.protocol)
      ? https
      : http).request(options, function(res) {
      //deal response header
      var statusCode = res.statusCode;
      //   statusCode =
      // userRule.replaceResponseStatusCode(req, res, statusCode) || statusCode

      //   var resHeader =
      // userRule.replaceResponseHeader(req, res, res.headers) || res.headers
      var resHeader = res.headers;

      // remove gzip related header, and ungzip the content
      // note there are other compression types like deflate
      var ifServerGzipped = /gzip/i.test(resHeader["content-encoding"]);
      if (ifServerGzipped) {
        delete resHeader["content-encoding"];
      }
      delete resHeader["content-length"];

      self.userRes.writeHead(statusCode, resHeader);

      //deal response data
      var length,
        resData = [];

      res.on("data", function(chunk) {
        resData.push(chunk);
      });

      res.on("end", function() {
        var serverResData = Buffer.concat(resData);

        //ungzip server res
        if (ifServerGzipped) {
          zlib.gunzip(serverResData, function(err, buff) {
            serverResData = buff;
          });
        } else {
          //   callback()
        }
        // jsonp wrap
        if (self.config.jsonp) {
          serverResData = jsonp(
            JSON.parse(serverResData.toString()),
            options.jsonp_function
          );
        }

        //send response
        if (global._throttle) {
          var thrStream = new Stream();

          var readable = thrStream.pipe(global._throttle.throttle());
          readable.pipe(userRes);

          thrStream.emit("data", serverResData);
          thrStream.emit("end");
        } else {
          self.userRes.end(serverResData);
        }

        //udpate record info
        self.resourceInfo.endTime = new Date().getTime();
        self.resourceInfo.statusCode = statusCode;
        self.resourceInfo.resHeader = resHeader;
        self.resourceInfo.resBody = serverResData;
        self.resourceInfo.length = serverResData ? serverResData.length : 0;

        // global.recorder &&
        //   global.recorder.updateRecord(resourceInfoId, resourceInfo)
      });
      res.on("error", function(error) {
        logUtil.printLog("error" + error, logUtil.T_ERR);
      });
    });

    proxyReq.on("error", function(e) {
      logUtil.printLog(
        "err with request :" + e + "  " + self.req.url,
        logUtil.T_ERR
      );
      self.userRes.end();
    });

    proxyReq.end(this.reqData);
  }
};
