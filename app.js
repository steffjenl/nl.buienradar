'use strict';

const Buienradar = require('buienradar');

const api = module.exports.api = new Buienradar({ lat: 52, lon: 5.1, requestCacheTimeout: 60000 });

const speechProcessor = require('./speech');
const flowProcessor = require('./flow');

module.exports.init = function init() {
	setLocation();

	speechProcessor.init();
	flowProcessor.init();
};

function setLocation() {
	Homey.manager('geolocation').on('location', (location) => {
		api.setLatLon(location.latitude, location.longitude);
	});

	Homey.manager('geolocation').getLocation((err, location) => {
		if (!err) {
			api.setLatLon(location.latitude, location.longitude);
		}
	});
}
