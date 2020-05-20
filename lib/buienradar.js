'use strict';

const fetch = require('node-fetch');
const moment = require('moment');

module.exports = class Buienradar {

	constructor({ lat, lon } = {}) {
		this.lat = lat;
		this.lon = lon;
	}

	async getForecasts() {
		const res = await fetch(`https://gpsgadget.buienradar.nl/data/raintext?lat=${this.lat}&lon=${this.lon}`);
		if( !res.ok ) throw new Error('Unknown Error');
		const text = await res.text();
		return this.constructor.parseForecast(text);
	}

    async getForecastsInsecure() {
        const res = await fetch(`http://gpsgadget.buienradar.nl/data/raintext?lat=${this.lat}&lon=${this.lon}`);
        if( !res.ok ) throw new Error('Unknown Error');
        const text = await res.text();
        return this.constructor.parseForecast(text);
    }

	static parseForecast(text) {
		return text.split('\n')
		.filter(item => {
			return typeof item === 'string' && item.length;
		})
		.map(item => {
			let [ mmh, time ] = item.trim().split('|');

			// calculate value in mm/h
			mmh = parseFloat(mmh);
			mmh = Math.pow(10, (mmh-109)/32);

			// calculate timeSince
			let date = moment(time, 'HH:mm').toDate();

			return {
				time,
				date,
				mmh,
			}
		});
	}

};
