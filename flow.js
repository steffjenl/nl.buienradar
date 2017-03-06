'use strict';

const Buienradar = require('buienradar');
const flowManager = Homey.manager('flow');

module.exports.init = function init() {
	setInterval(checkRaining, 2.5 * 60 * 1000);
	checkRaining();

	const rainingInState = new Map();
	const dryInState = new Map();
	Homey.manager('flow').on('trigger.raining_in', (callback, args) => {
		checkRainingIn(false, (err, state) => {
			if (err) return callback(err);

			callback(null, state && !rainingInState.get(args.when));
			rainingInState.set(args.when, state);
		}, args);
	});
	Homey.manager('flow').on('trigger.dry_in', (callback, args) => {
		checkRainingIn(false, (err, state) => {
			if (err) return callback(err);

			state = !state;
			callback(null, state && !dryInState.get(args.when));
			dryInState.set(args.when, state);
		}, args);
	});
	Homey.manager('flow').on('condition.raining_in', checkRainingIn.bind(null, true));
	Homey.manager('flow').on('condition.is_raining', checkIsRaining);
};

let wasRaining = false;
function checkRaining(retryCount) {
	console.log(new Date().toISOString(), 'checkRaining', retryCount);
	Homey.app.api.getRainData(true).then(rainData => {
		const isRaining = isRainTill(rainData, Date.now());

		if (isRaining && !wasRaining) {
			flowManager.trigger('rain_start');
		} else if (!isRaining && wasRaining) {
			flowManager.trigger('rain_stop');
		}
		wasRaining = isRaining;

		flowManager.trigger('raining_in');
		flowManager.trigger('dry_in');
	}).catch(() =>
			!retryCount || retryCount < 5 ? setTimeout(checkRaining.bind(null, (retryCount || 0) + 1), 1000 * (retryCount || 0)) : null
	);
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
