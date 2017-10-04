//necessary includes, eg http-proxy library
var httpProxy = require("http-proxy");
var http = require("http");
var url = require("url");
var net = require('net');
var fs   = require('fs');

//setup for blacklisting
var blacklist = [];
fs.watchFile('./blacklist.txt', function(c,p) { update_blacklist(); });
//blacklisted urls will be stored in a file
function update_blacklist() {
  //blacklisted websites stored locally in blacklist.txt
  blacklist = fs.readFileSync('./blacklist.txt').toString().split('\n')
              .filter(function(rx) { return rx.length })
              .map(function(rx) { return RegExp(rx) });
}

//create server for http requests
var server = http.createServer(function (req, res) {
  //check blacklist file to see if request must be denied
  for(i in blacklist){
    if (blacklist[i].test(req.url)) {
      console.log("Denied: " + req.method + " " + req.url);
      res.end();
      return;
    }
  }
    //parsing url
    var urlObj = url.parse(req.url);
    var target = urlObj.protocol + "//" + urlObj.host;
    console.log("Proxy HTTP request for:", target);
    //handling in case of an error
    var proxy = httpProxy.createProxyServer({});
    proxy.on("error", function (err, req, res) {
      console.log("Error with the URL.");
      res.end();
    });
    proxy.web(req, res, {target: target});
}).listen(3000);  //client port

update_blacklist();

//server setup for https using 'connect' check
server.addListener('connect', function (req, socket, bodyhead) {
  var urlObjS = url.parse(req.url);
  var targetS = urlObjS.protocol + "//" + urlObjS.host;
  //splitting string for output
  var hostDomain = req.url.split(":")[0];
  
  console.log("Proxying HTTPS request for:", hostDomain);

  var proxySocket = new net.Socket();
  proxySocket.connect(443, hostDomain, function () {
      proxySocket.write(bodyhead);
      socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    }
  );

  proxySocket.on('data', function (chunk) {
    socket.write(chunk);
  });

  proxySocket.on('end', function () {
    socket.end();
  });

  proxySocket.on('error', function () {
    socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
    socket.end();
  });

  socket.on('data', function (chunk) {
    proxySocket.write(chunk);
  });

  socket.on('end', function () {
    proxySocket.end();
  });

  socket.on('error', function () {
    proxySocket.end();
  });

});