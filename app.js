'use strict';

const {App, ManagerGeolocation} = require('homey');
const Buienradar = require('./lib/buienradar');
const FlowManager = require('./flow');
const SpeechManager = require('./speech');

class BuienradarApp extends App {
	onInit() {
		this.api = new Buienradar({ lat: 52, lon: 5.1, requestCacheTimeout: 60000 });

		this.setLocation();
		this.speechManager = new SpeechManager();
		this.flowManager = new FlowManager(this.api);
	}

	setLocation() {
		ManagerGeolocation.on('location', (location) => { // was not working
			this.api.setLatLon(location.latitude, location.longitude);
		});

		this.api.setLatLon(ManagerGeolocation.getLatitude(), ManagerGeolocation.getLongitude());
	}
}

module.exports = BuienradarApp;
