var express = require('express');
var app = express();
var path = require('path');

var port = 8080;

app.use(express.static(__dirname + '/client'));

// viewed at http://localhost:<port>
app.get('/', function(req, res) {
	console.log('Listening on port ' + port + '...');
    res.sendFile(path.join(__dirname, 'client', index.html));
});

app.listen(port);
