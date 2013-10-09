// api.js
var express = require('express');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var mongo = require('mongoskin');
var db = mongo.db('localhost:27017/nsw_traffic', {safe: true});
var PORT = 9000;

// --- Serve the API
var api = express();

api.use(express.bodyParser());
api.use(express.static(__dirname));

var headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

api.get('/stops', function(req, res) {
  res.set(headers);
  db.collection('stops').find({ route_id: routeId }).toArray(function (err, stops) {
    res.send(JSON.stringify(stops));
  });
});

api.get('/trip/:route_id', function(req, res) {
  var resp = {};
  var routeId = req.params.route_id;

  db.collection('trips').find({ route_id: routeId }).toArray(function (err, tripsArray) {
    var tripId = tripsArray[0].trip_id;
    console.log(tripId);
    resp.trips = tripsArray;

    db.collection('stop_times').find({ trip_id: tripId }).toArray(function(err, timesArray) {
      var stopIds =  _.pluck(timesArray, 'stop_id');
      console.log(stopIds);
      resp.stop_times = timesArray;

      db.collection('stops').find({'stop_id': { $in: stopIds }}).toArray(function(err, stopsArray){
          console.log(stopsArray);
          resp.stops = stopsArray;
          res.set(headers);
          res.send(resp);
      });
    });
  });
});

api.get('/route/:route_id?', function(req, res) {
  console.log(req.params.route_id);
  if( req.params.route_id ) {
    db.collection('routes').find({ route_id: req.params.route_id }).toArray(function (err, routes) {
      res.set(headers);
      res.send(JSON.stringify(routes));
    });
  }
  else {
    db.collection('routes').find().toArray(function (err, routes) {
      res.set(headers);
      res.send(JSON.stringify(routes));
    });
  }
});


api.get('/shape/:route_id?', function(req, res) {
  var routeId = req.params.route_id;
  
  if( routeId ) {
    console.log('Finding Shape for Route: ' + routeId);
    db.collection('trips').find({route_id: routeId }).toArray(function (err, trips) {
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

        res.set(headers);
        res.send(JSON.stringify(geoJsonFeature));
      });
    });
  }
  else {
    var geoJsonFeatures = [];
    console.log('Find All Shapes...');

    db.collection('trips').find({}, { shape_id: 1 }).toArray(function (err, trips) {
      var shapeId,
          allShapeIds = _.uniq(_.pluck(trips, 'shape_id'));

      (allShapeIds.slice(0, 1)).forEach(function(id) {
        
        // get all the points of the line string
        db.collection('shapes').find({ shape_id: id }).toArray(function(err, shapes) {
          console.log(shapes);
          var geoJsonFeature = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: _.zip(_.pluck(shapes, 'shape_pt_lon'), _.pluck(shapes, 'shape_pt_lat'))
            },
            properties: {
              shape_id: id
            }
          };
          
          geoJsonFeatures.push(geoJsonFeature);
        });
      });
      
      console.log(geoJsonFeatures.length);
      res.set(headers);
      res.send(JSON.stringify(geoJsonFeatures));
    });
  }
});

api.listen(PORT);
console.log('API listening on :' + PORT);