'use strict';

const Buienradar = require('buienradar');

const api = module.exports.api = new Buienradar({lat: 52, lon: 5.1});

const speechProcessor = require('./speech');

module.exports.init = function(){
  setLocation();

  speechProcessor.init();

};

function setLocation(){
  Homey.manager('geolocation').on('location', function (location) {
    api.setLatLon(location.latitude, location.longitude);
  });

  Homey.manager('geolocation').getLocation(function (err, location) {
    if(!err) {
      api.setLatLon(location.latitude, location.longitude);
    }
  });
}