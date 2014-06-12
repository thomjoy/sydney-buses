var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    pg = require('pg'),
    Cursor = require('pg-cursor'),
    api = express(),
    PORT = 9000;

var headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

var conString = "postgres://thomjoy:@localhost/nsw_traffic";
var pgErrHandler = function(err) { return console.log(err); };

api.use(express.bodyParser());
api.use(express.static(__dirname));

// -- Get a route by route_id, or get all routes
api.get('/route/:route_id?', function(req, res) {
  
  var base = 'SELECT * FROM routes';
  var query = base += req.params.route_id ? ' WHERE route_id = $1' : '';
  var params = req.params.route_id ? [req.params.route_id] : [];

  pg.connect(conString, function(err, client, done) {
    done();
    if( err ) pgErrHandler(err);

    client.query(query, params, function(err, routes) {
      if( err ) pgErrHandler(err);

        res.set(headers);
        res.send(JSON.stringify(routes.rows));
    });
  });
});

api.get('/search', function(req, res) {
  var qs = req.query;
  console.log(qs);

  var query = "SELECT stop_id, stop_code, stop_code, stop_name, ST_AsGeoJSON(geom) as geoJson \
      FROM stops \
      WHERE ST_DWithin( \
        stops.geom, \
        ST_SetSRID(ST_MakePoint($1, $2), 26913), \
      $3)";

  var params = [qs.lon, qs.lat, parseFloat(parseInt(qs.distance) / 1000)];
  console.log(params);

  pg.connect(conString, function(err, client, done) {
    done();
    if( err ) pgErrHandler(err);

    client.query(query, params, function(err, stops) {
        res.set(headers);
        res.send(JSON.stringify(stops.rows));
    });
  });
});

api.listen(PORT);
console.log('API listening on :' + PORT);