


```
rewrite2(req, res,'http://anyproxy.io/aasd' )
```

```
rewrite2(req, res, {
    url: 'http://anyproxy.io/aasd'
})
```

```
rewrite2(req, res, {
    host: 'anyproxy.io:3000'
})
```


```
rewrite2(req, res, {
    hostname: 'anyproxy.io'
})
```

```
rewrite2(req, res, {
    method: 'get|post'
    hostname: 'anyproxy.io'
})
```




```
rewrite2(req, res, {
  protocol: 'http',
  url: 'http://anyproxy.io/',
  requestOptions: {
    hostname: 'anyproxy.io',
    port: 80,
    path: '/',
    method: 'GET',
    headers: {
      Host: 'anyproxy.io',
      'Proxy-Connection': 'keep-alive',
      'User-Agent': '...'
    }
  },
  requestData: '...',
})
```