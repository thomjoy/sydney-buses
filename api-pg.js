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
  
  var base = "SELECT * FROM routes WHERE route_short_name IN ('301', '302', '303')";
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

api.get('/trip/?:route_id', function(req, res) {
  var resp = {};
  var routeId = req.params.route_id;

  var queries
  var params = [];

  pg.connect(conString, function(err, client, done) {
    if( err ) pgErrHandler(err);
    
    var queries ={
      trips: {
        query: "SELECT * FROM trips WHERE route_id = $1",
        params: [req.params.route_id]
      },
      stop_times: {
        query: "SELECT * FROM stop_times WHERE trip_id = $1",
        params: [],
      },
      stops: {
        query: "SELECT * FROM stops WHERE stop_id IN (SELECT stop_id FROM stop_times WHERE trip_id = $1)",
        params: []
      }
    };

    var resp = {};
    console.log(req.params.route_id);
    client.query(queries.trips.query, queries.trips.params, function(err, trip) {
      if( err ) pgErrHandler(err);
      
      queries.stop_times.params.push("" + trip.rows[0].trip_id);
      resp.trips = trip.rows;

      console.log('Trips for: ' + req.params.route_id + ' = ' + resp.trips.length);

      client.query(queries.stop_times.query, queries.stop_times.params, function(err, stopTimes) {
        if( err ) pgErrHandler(err);

        var stopIds =  _.map(_.pluck(stopTimes.rows, 'stop_id'), function(id) { return parseInt(id, 10); });
        resp.stop_times = stopTimes.rows;

        var q = "SELECT * FROM stops WHERE stop_id IN (" + stopIds.map(function(stopIds, idx) {return '$' + (idx+1);}).join(',') + ")";
        console.log(q);
        console.log(stopIds);

        client.query(q, stopIds, function(err, stops) {
          if( err ) pgErrHandler(err);

          resp.stops = stops.rows;
          res.set(headers);
          res.send(JSON.stringify(resp));
        });
      });
    });
  });
});

api.get('/stops/:trip_id', function(req, res) {
  var resp = {};

  pg.connect(conString, function(err, client, done) {
    if( err ) pgErrHandler(err);
    client.query("SELECT * FROM stop_times WHERE trip_id = $1", [req.params.trip_id], function(err, stopTimes) {
      if( err ) pgErrHandler(err);

      var stopIds =  _.map(_.pluck(stopTimes.rows, 'stop_id'), function(id) { return parseInt(id, 10); });
      var stopTimes = stopTimes.rows;

      var q = "SELECT * FROM stops WHERE stop_id IN (" + stopIds.map(function(stopIds, idx) {return '$' + (idx+1);}).join(',') + ")";
      console.log(q);
      console.log(stopIds);

      client.query(q, stopIds, function(err, stops) {
        if( err ) pgErrHandler(err);

        var markersGeoJson = [];
        stops.rows.forEach(function( stop ) {
          markersGeoJson.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [stop.stop_lon, stop.stop_lat]
            },
            properties: {
              stop_name: stop.stop_name,
              stop_id: stop.stop_id,
              "title": stop.stop_name,
              "description": stop.stop_id,
              "marker-color": "#fc4353",
              "marker-size": "small"
            }
          });
        });

        stops.rows.forEach(function(stop) {
          var stopTimeData = stopTimes.filter(function(s) { return s.stop_id == stop.stop_id; });
          _.extend(stop, stopTimeData);
        });

        resp.data = stops.rows;
        resp.geojson = markersGeoJson;
        res.set(headers);
        res.send(JSON.stringify(resp));
      });
    });
  });
});

api.get('/shape/:route_id?', function(req, res) {
  var routeId = req.params.route_id;
  console.log('Finding Shape for Route: ' + routeId);

  pg.connect(conString, function(err, client, done) {
    done();
    if( err ) pgErrHandler(err);

    client.query("SELECT shape_id, trip_id FROM trips WHERE route_id = $1", [routeId], function(err, trips) {
      if( err ) pgErrHandler(err);

      var item = trips.rows[0];
      var shapeId = item.shape_id;

      client.query("SELECT * FROM shapes WHERE shape_id = $1", [shapeId], function(err, shapes) {
        if( err ) pgErrHandler(err);

        var shapes = shapes.rows;
        var shapeGeoJson = {
          type: "Feature",
          bbox: (function() {
            // get the coords of the first and last shape in the sequences
            var first = shapes[0];
            var last = shapes[shapes.length - 1];
            return [
              [first['shape_pt_lat'], first['shape_pt_lon']],
              [last['shape_pt_lat'], last['shape_pt_lon']]
            ];
          })(),
          geometry: {
            type: "LineString",
            coordinates: _.zip(_.pluck(shapes, 'shape_pt_lon'), _.pluck(shapes, 'shape_pt_lat'))
          },
          properties: {
            shape_id: shapeId
          }
        };

        res.set(headers);
        res.send(JSON.stringify(shapeGeoJson));
      });
    });
  });
});

api.get('/search', function(req, res) {
  var qs = req.query;
  var query = "SELECT stop_id, stop_code, stop_lon, stop_lat, stop_name, ST_AsGeoJSON(geom) as geoJson \
  FROM stops \
  WHERE ST_Distance_Sphere(stops.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) <= $3";

  var distance = qs.distance[0] == "0" ? parseFloat(qs.distance) : parseInt(qs.distance);
  var params = [qs.lon, qs.lat, parseFloat(distance * 1000)];

  pg.connect(conString, function(err, client, done) {
    done();
    if( err ) pgErrHandler(err);

    client.query(query, params, function(err, stops) {
        
        stops.rows.forEach(function(stop) {
          var geoJson = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [stop.stop_lon, stop.stop_lat]
            },
            properties: {
              stop_name: stop.stop_name,
              stop_id: stop.stop_id,
              "title": stop.stop_name,
              "description": stop.stop_id,
              "marker-color": "#fc4353",
              "marker-size": "small"
            }
          };
          stop.geojson = JSON.stringify(geoJson);
        });

        res.set(headers);
        res.send(JSON.stringify(stops.rows));
    });
  });
});

api.listen(PORT);
console.log('API listening on :' + PORT);