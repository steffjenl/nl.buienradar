'use strict';

const Buienradar = require('buienradar');
const flowManager = Homey.manager('flow');

module.exports.init = function init() {
	setInterval(checkRaining, 5 * 60 * 1000);

	Homey.manager('flow').on('trigger.raining_in', checkRainingIn.bind(null, false));
	Homey.manager('flow').on('condition.raining_in', checkRainingIn.bind(null, true));
	Homey.manager('flow').on('condition.is_raining', checkIsRaining);
};

let wasRaining = false;
function checkRaining() {
	Homey.app.api.getRainData().then(rainData => {
		const isRaining = isRainTill(rainData, Date.now());

		if (isRaining && !wasRaining) {
			flowManager.trigger('rain_start');
		} else if (!isRaining && wasRaining) {
			flowManager.trigger('rain_stop');
		}
		wasRaining = isRaining;

		Homey.manager('flow').trigger('raining_in');
	});
}

function checkRainingIn(fromStart, callback, args) {
	Homey.app.api.getRainData().then(rainData => {
		const checkDate = Date.now() + args.when * 60 * 1000;

		const isRaining = isRainTill(rainData, checkDate, fromStart ? null : (checkDate - 6 * 60 * 1000));

		callback(null, isRaining);

	}).catch(err => callback(err));
}

function checkIsRaining(callback) {
	Homey.app.api.getRainData()
		.then(rainData => callback(null, rainData[0].indication >= Buienradar.rainIndicators.LIGHT_RAIN))
		.catch(err => callback(err));
}

function isRainTill(rainData, endDate, startDate, indication) {
	endDate = rainData[0].time <= endDate ? endDate : rainData[0].time;
	startDate = startDate || rainData[0].time;
	startDate = rainData[rainData.length - 1].time >= startDate ? startDate : rainData[rainData.length - 1].time;
	endDate = endDate >= startDate ? endDate : startDate;
	indication = !isNaN(indication) ? indication : Buienradar.rainIndicators.LIGHT_RAIN;

	return rainData.reduce(
		(prev, data) => prev || ((data.time <= endDate && data.time >= startDate) && data.indication >= indication),
		false
	);
}
