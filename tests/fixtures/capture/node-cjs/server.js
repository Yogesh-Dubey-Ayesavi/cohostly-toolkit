require("node:fs").appendFileSync(__dirname + "/pids.txt", process.pid + "\n");
const http = require('node:http');
const key = process.env.API_KEY;
http.createServer((req, res) => res.end('ok ' + (key ? 'key' : 'nokey'))).listen(process.env.PORT || 0, '0.0.0.0');
