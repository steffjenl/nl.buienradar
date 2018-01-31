'use strict';

const Buienradar = require('./lib/buienradar');
const {FlowCardTrigger, FlowCardCondition} = require('homey');

class FlowManager {
	constructor(api) {
		this.api = api;
		this.wasRaining = false;
		setInterval(this.checkRaining.bind(this), 2 * 60 * 1000);

		const rainingInState = new Map();
		const dryInState = new Map();

		// Raining in trigger and condition
		this.rainingInTrigger = new FlowCardTrigger('raining_in');
		this.rainingInTrigger.registerRunListener( async (args, state) => {
			let rainingIn = await this.checkRainingIn(false, args);
			let result = rainingIn && !rainingInState.get(args.when);
			rainingInState.set(args.when, rainingIn);
			return result;
		}).register();

		this.rainingInCondition = new FlowCardCondition('raining_in');
		this.rainingInCondition.registerRunListener(this.checkRainingIn.bind(this, true)).register();

		// Dry in trigger
		this.dryInTrigger = new FlowCardTrigger('dry_in');
		this.dryInTrigger.registerRunListener( async (args, state) => {
			let dryIn = await this.checkRainingIn(false, args);
			let result = dryIn && !dryInState.get(args.when);
			dryInState.set(args.when, dryIn);
			return result;
		}).register();

		this.rainingCondition = new FlowCardCondition('is_raining');
		this.rainingCondition.registerRunListener(this.checkIsRaining.bind(this, true)).register();

		// Rain start trigger
		this.rainStartTrigger = new FlowCardTrigger('rain_start').register();

		// Rain stop trigger
		this.rainStopTrigger = new FlowCardTrigger('rain_stop').register();
	}

	delay(timeout) {
		return new Promise(resolve => {
			setTimeout(resolve, timeout);
		});
	}

	async checkRainingIn(fromStart, args) {
		let rainData = await this.api.getRainData();
		const checkDate = Date.now() + args.when * 60 * 1000;
		return isRainTill(rainData, checkDate, fromStart ? null : (checkDate - 6 * 60 * 1000));
	}

	async checkIsRaining() {
		let rainData = await this.api.getRainData();
		return rainData[0].indication >= Buienradar.rainIndicators.LIGHT_RAIN;
	}

	async checkRaining() {
		let retryCount = 0;

		for (var i = 0; i < 4; i++) {
			try {
				let rainData = await this.api.getRainData();
				const isRaining = this.isRainTill(rainData, Date.now());

				if (isRaining && !wasRaining) {
					this.rainStartTrigger.trigger();
				} else if (!isRaining && wasRaining) {
					this.rainStopTrigger.trigger();
				}

				wasRaining = isRaining;

				this.rainingInTrigger.trigger();
				this.dryInTrigger.trigger();
			} catch(err) {
				await this.delay(1000 * retryCount);
			}
		}

		throw new Error('Buienradar API offline');
	}

	isRainTill(rainData, endDate, startDate, indication) {
		endDate = rainData[0].time <= endDate ? endDate : rainData[0].time;
		startDate = startDate || rainData[0].time;
		startDate = rainData[rainData.length - 1].time >= startDate ? startDate : rainData[rainData.length - 1].time;
		endDate = endDate >= startDate ? endDate : startDate;
		indication = !isNaN(indication) ? indication : Buienradar.rainIndicators.LIGHT_RAIN;

		return rainData.reduce((prev, data) => prev || ((data.time <= endDate && data.time >= startDate) && data.indication >= indication), false);
	}
}

module.exports = FlowManager;
