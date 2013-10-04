// api.js
var express = require('express');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var mongo = require('mongoskin');
var db = mongo.db('localhost:27017/nsw_traffic', {safe: true});

// --- Serve the API
var api = express();

api.use(express.bodyParser());

var headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

api.get('/stops', function(req, res) {
  res.set(headers);
  db.collection('stops').find().toArray(function (err, routes) {
    res.send(JSON.stringify(routes));
  });
});

api.get('/trips', function(req, res) {
  res.set(headers);
  res.send(gtfsData.trips);
});

api.get('/routes', function(req, res) {
  res.set(headers);
  console.log('/routes ' + mapData.routes);
  db.collection('routes').find().toArray(function (err, routes) {
    res.send(JSON.stringify(routes));
  });
});

api.get('/shapes/:route_id', function(req, res) {
  res.set(headers);

  var routeId = req.params.route_id;
  console.log(routeId);

  db.collection('trips').find( {route_id: routeId }).toArray(function (err, trips) {
    // for now just pick one...
    var item = trips[0];
    var shapeId = item.shape_id;

    // get all the points of the line string
    db.collection('shapes').find({ shape_id: shapeId }).toArray(function(err, shapes) {
      var geoJsonFeature = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: _.zip(_.pluck(shapes, 'shape_pt_lon'), _.pluck(shapes, 'shape_pt_lat'))
        },
        properties: {
          shape_id: shapeId
        }
      };

      res.send(JSON.stringify(geoJsonFeature));
    });
  });
});

api.listen(9001);
console.log('API listening on :9001');