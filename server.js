var express = require('express');
var app = express();
var path = require('path');

// Default to use 8080, unless environment variable is set:
if (process.env.PORT == undefined) {
	var port = 8080
} else{
	var port = process.env.PORT;
}

console.log(port)

app.use(express.static(__dirname + '/client'));

// viewed at http://localhost:<port>
console.log('View page on http://localhost:' + port);

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'client', index.html));
});

app.listen(port);
