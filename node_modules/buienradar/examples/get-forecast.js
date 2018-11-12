'use strict';

const Buienradar = require('..');

// create a Buienradar instance
const b = new Buienradar({
	lat: 52.22377,
	lon: 6.87236,
});

// create a Date object 30 minutes from now
let now = new Date();
let after = new Date(now.getTime() + 30 * 60000);

// get the forecast
b.getNextForecast({ after }).then(forecast => {
	console.log('The next forecast is:', forecast);
}).catch(console.error);