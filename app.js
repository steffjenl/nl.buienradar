'use strict';

const Buienradar = require('buienradar');

const api = new Buienradar({ lat: 52, lon: 5.1, requestCacheTimeout: 60000 });

const speechProcessor = require('./speech');
const flowProcessor = require('./flow');

function init() {
	setLocation();

	speechProcessor.init();
	flowProcessor.init();
}

function setLocation(callback) {
	// Homey.manager('geolocation').on('location', (location) => { // was not working
	// 	api.setLatLon(location.latitude, location.longitude);
	// });

	Homey.manager('geolocation').getLocation((err, location) => {
		if (!err && location) {
			api.setLatLon(location.latitude, location.longitude);
		}
		if (callback) {
			callback(err || (!location || location.latitude === false || location.longitude === false), location);
		}
	});
}

module.exports = {
	init,
	setLocation,
	api,
};
