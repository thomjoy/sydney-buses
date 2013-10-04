var util = require('util'),
    connect = require('connect'),
    PORT = 9000;

connect.createServer(connect.static(__dirname)).listen(PORT);
util.puts('Static Server listening on :' + PORT);