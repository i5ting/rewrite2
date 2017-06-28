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
  async = require("async"),
  color = require("colorful"),
  Buffer = require("buffer").Buffer,
  util = require("./util"),
  Stream = require("stream"),
  logUtil = require("./log"),
  ThrottleGroup = require("stream-throttle").ThrottleGroup;

// to fix issue with TLS cache, refer to: https://github.com/nodejs/node/issues/8368
https.globalAgent.maxCachedSessions = 0;

module.exports = function() {};

module.exports.proxy = function(req, userRes, config) {
  if (typeof config === "string") config = { url: config };
  let querystring = url.parse(req.url).query
  req.query = qs.parse(querystring);
  /*
    note
        req.url is wired
        in http  server : http://www.example.com/a/b/c
        in https server : /a/b/c
    */

  var host = req.headers.host,
    protocol = !!req.connection.encrypted && !/^http:/.test(req.url)
      ? "https"
      : "http",
    //fullUrl = protocol === "http" ? req.url : protocol + "://" + host + req.url,
    fullUrl = config.url ? config.url+ '?' + querystring : protocol + "://" + host + req.url,
    urlPattern = url.parse(fullUrl),
    path = urlPattern.path,
    resourceInfo,
    resourceInfoId = -1,
    reqData;

  if (urlPattern.query) urlPattern.query = querystring

  if (config.host) {
    urlPattern.host = config.host;
    var arr = config.host.split(":");
    urlPattern.hostname = arr[0];
    urlPattern.port = arr.length === 1 ? 80 : arr[1];
  }

  if (config.hostname) {
    urlPattern.hostname = config.hostname;
    urlPattern.host = urlPattern.hostname + ":" + urlPattern.port;
  }

  if (config.port) {
    urlPattern.port = config.port;
    urlPattern.host = urlPattern.hostname + ":" + urlPattern.port;
  }

  if (config.path) {
      urlPattern.path = config.path;
  }

  if (config.pathname) {
      urlPattern.pathname = config.pathname;
  }

  if (req.headers.host) req.headers.host = urlPattern.host;
  // console.log(req.url);
  // console.log(path);

  //record
  resourceInfo = {
    host: host,
    method: req.method,
    path: path,
    protocol: protocol,
    url: protocol + "://" + host + path,
    req: req,
    startTime: new Date().getTime()
  };

  if (global.recorder) {
    // resourceInfoId = global.recorder.appendRecord(resourceInfo);
  }

  //   logUtil.printLog(color.green("\nreceived request to : " + host + path));

  //get request body
  function getReqBody() {
    return new Promise(function(resolve, reject) {
      var postData = [];
      req.on("data", function(chunk) {
        postData.push(chunk);
      });
      req.on("end", function() {
        reqData = Buffer.concat(postData);
        resourceInfo.reqBody = reqData.toString();

        resolve();
        // global.recorder && global.recorder.updateRecord(resourceInfoId,resourceInfo);
      });
    });
  }

  // proxy for mock or rewrite
  function dealWithRemoteResonse(callback) {
    var options;

    //modify request protocol
    // protocol = userRule.replaceRequestProtocol(req, protocol) || protocol;

    //modify request options
    defaultOptions = {
      hostname: urlPattern.hostname || req.headers.host,
      port: urlPattern.port || req.port || (/https/.test(protocol) ? 443 : 80),
      path: path,
      method: req.method,
      headers: req.headers,
      jsonp: false,
      jsonp_function: req.query.callback || "callback",
      filter: function(options) {}
    };

    var options = extend(defaultOptions, config);

    // 赋值后，仍然可以通过此方法修改request options
    if (config.filter) options = config.filter(options);

    // options = userRule.replaceRequestOption(req, options) || options;
    options.rejectUnauthorized = false;
    try {
      delete options.headers["accept-encoding"]; //avoid gzipped response
    } catch (e) {}

    //update request data
    // reqData = userRule.replaceRequestData(req, reqData) || reqData;
    options.headers = util.lower_keys(options.headers);

    // options.headers["content-length"] = reqData.length; //rewrite content length info

    options.headers = util.upper_keys(options.headers);

    //send request
    var proxyReq = (/https/.test(protocol)
      ? https
      : http).request(options, function(res) {
      //deal response header
      var statusCode = res.statusCode;
      //   statusCode =
      // userRule.replaceResponseStatusCode(req, res, statusCode) || statusCode;

      //   var resHeader =
      // userRule.replaceResponseHeader(req, res, res.headers) || res.headers;
      resHeader = util.lower_keys(res.headers);

      // remove gzip related header, and ungzip the content
      // note there are other compression types like deflate
      var ifServerGzipped = /gzip/i.test(resHeader["content-encoding"]);
      if (ifServerGzipped) {
        delete resHeader["content-encoding"];
      }
      delete resHeader["content-length"];

      userRes.writeHead(statusCode, resHeader);

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
          //   callback();
        }
        // jsonp wrap
        if (config.jsonp) {
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
          userRes.end(serverResData);
        }

        //udpate record info
        resourceInfo.endTime = new Date().getTime();
        resourceInfo.statusCode = statusCode;
        resourceInfo.resHeader = resHeader;
        resourceInfo.resBody = serverResData;
        resourceInfo.length = serverResData ? serverResData.length : 0;

        // global.recorder &&
        //   global.recorder.updateRecord(resourceInfoId, resourceInfo);
      });
      res.on("error", function(error) {
        logUtil.printLog("error" + error, logUtil.T_ERR);
      });
    });

    proxyReq.on("error", function(e) {
      logUtil.printLog(
        "err with request :" + e + "  " + req.url,
        logUtil.T_ERR
      );
      userRes.end();
    });

    proxyReq.end(reqData);
  }

  getReqBody().then(function(params) {
    dealWithRemoteResonse();
  });
};
