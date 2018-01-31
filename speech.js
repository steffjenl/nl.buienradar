'use strict';

const Buienradar = require('./lib/buienradar');
const Homey = require('homey');

class SpeechManager {
	constructor() {

		Homey.ManagerSpeechInput.on('speechEval', async ( speech, callback ) => {
				// let match = await this.speechToAnswer(speech);
				//console.log(`Match found: ${match}`);
		    //callback( null, match );
				//return match;
				callback(null, "test123");
		});

		Homey.ManagerSpeechInput.on('speechMatch', (speech, response) => {

			console.dir(speech, {depth: null});

			if (Homey.app.api.hasLocation()) {
				speech.say(response);
				// Homey.ManagerSpeechOutput.say(response);
			} else {
				Homey.app.setLocation();
				speech.say(response);
				// Homey.ManagerSpeechOutput.say(response);
			}

			console.log('Speechmatch finished');
		});
	}

	async speechToAnswer(speech) {
		const dataRequest = Homey.app.api.getRainData();
		const triggers = {};
		const options = {
			responseType: 'simple',
			inTime: undefined,
			raining: true,
			rainType: undefined,
			rainTypeString: '',
			cantNegate: false,
			fromTime: new Date(),
			toTime: undefined,
			minRain: undefined,
			maxRain: undefined,
			checkInterval: undefined,
			soon: false,
		};
		const result = {
			start: '',
			rain: '',
			time: '',
			end: '',
		};

		if (speech.times) {
			const now = new Date();
			speech.times = speech.times.sort( (a, b) => a.index - b.index);
			speech.times.forEach( time => {
				time.date = new Date(
					time.time.year || now.getFullYear(),
					time.time.month || now.getMonth(),
					time.time.day || now.getDay(),
					time.time.hour || now.getHours(),
					time.time.minute || 0,
					time.time.second || 0
				);
			});
		}

		speech.matches = speech.matches.sort( (a, b) => a.position - b.position);
		speech.matches.keys.forEach(key => {
			switch (key) {
				case 'objects':
					options.raining = true;
					break;
				case 'forecastsType':
					if (speech.matches['forecastsType'].transcript !== ('dry' || 'droog') ) {
						options.raining = true;
					} else {
						options.raining = false;
					}
					break;
				case 'negates':
					options.raining = !options.raining;
					break;
				case 'severities':
					break;
				default:
			}
		});
    //
		// if (speech.time) {
		// 	const now = new Date();
		// 	speech.time = speech.time.sort((a, b) => a.index - b.index);
		// 	speech.time.forEach(time => {
		// 		time.date = new Date(
		// 			time.time.year || now.getFullYear(),
		// 			time.time.month || now.getMonth(),
		// 			time.time.day || now.getDay(),
		// 			time.time.hour || now.getHours(),
		// 			time.time.minute || 0,
		// 			time.time.second || 0
		// 		);
		// 	});
		// }
		speech.triggers = speech.triggers.sort((a, b) => a.position - b.position);
		speech.triggers.forEach(trigger => triggers[trigger.id] = trigger);
		speech.triggers.forEach(trigger => {
			switch (trigger.id) {
				case 'dry':
					options.raining = !options.raining;
					options.rain = trigger.text;
					break;
				case 'negate':
					options.raining = options.cantNegate || !options.raining;
					break;
				case 'longer':
				case 'for': {
					options.responseType = 'interval';
					const forTime = this.getTimeAfterIndex(speech, trigger.position);
					if (forTime && !isNaN(forTime.date)) {
						if (trigger.id === 'longer') {
							forTime.date = new Date(forTime.date + 60000);
						}
						options.checkInterval = forTime.date - Date.now();
						if (!triggers.when) {
							options.toTime = options.toTime || forTime.date;
						}
						result.time = '';
					}
					break;
				}
				case 'in': {
					const inTime = this.getTimeAfterIndex(speech, trigger.position);
					if (inTime && !isNaN(inTime.date)) {
						const slack = 3 * 60 * 1000;
						options.fromTime = new Date(inTime.date.getTime() - slack);
						options.toTime = new Date(inTime.date.getTime() + (!isNaN(options.checkInterval) ? options.checkInterval : slack));
						result.time = Homey.__('time.in', { time: this.getTimeDeltaString(inTime.date) });
						options.inTime = inTime.date;
					}
					break;
				}
				case 'from_now': {
					const fromNowTime = this.getTimeAfterIndex(speech, trigger.position, true);
					if (fromNowTime && !isNaN(fromNowTime.date)) {
						const slack = 3 * 60 * 1000;
						options.fromTime = new Date(fromNowTime.date.getTime() - slack);
						options.toTime = new Date(fromNowTime.date.getTime() + (!isNaN(options.checkInterval) ? options.checkInterval : slack));
						result.time = Homey.__('time.in', { time: this.getTimeDeltaString(fromNowTime.date) });
						options.inTime = fromNowTime.date;
					}
					break;
				}
				case 'coming':
					options.fromTime = new Date();
					options.toTime = this.getTimeAfterIndex(speech, trigger.position).date;
					result.time = '';
					options.inTime = undefined;
					break;
				case 'soon':
					options.soon = true;
					options.fromTime = new Date();
					options.toTime = new Date(Date.now() + 30 * 60 * 1000);
					break;
				case 'umbrella':
					options.responseType = 'umbrella';
					options.umbrella = trigger.text;
					options.raining = true;
					options.cantNegate = true;
					break;
				case 'light':
				case 'moderate':
				case 'heavy':
				case 'violent':
					options.checkInterval = 0;
					options.minRain = this.getRainIndicationFromTrigger(trigger);
					options.rainType = options.minRain;
					options.rainTypeString = `${this.getRainIndicationString(options.minRain)} `;
					break;
				default:
					break;
			}
		});
		if (!options.raining) {
			options.maxRain = options.maxRain ||
				(options.minRain ? this.changeIndicatorBySteps(options.minRain, -1) : false) ||
				Buienradar.rainIndicators.NO_RAIN;
			options.minRain = Buienradar.rainIndicators.NO_RAIN;
		}
		if (options.responseType === 'umbrella' && options.inTime) {
			options.fromTime = options.inTime;
			options.toTime = null;
		}
		if (triggers.when && triggers.in) {
			result.time = '';
			options.toTime = null;
		}
		options.minRain = options.minRain || Buienradar.rainIndicators.LIGHT_RAIN;

		Homey.app.log('speech parsed', speech, options);

		return dataRequest.then(rainData => {
			if (rainData.length === 0) {
				return Homey.__('error.no_data');
			}

			const rainTime = this.getRainTime(rainData, options.minRain, options.maxRain, options.fromTime, options.toTime, options.checkInterval);

			if (!rainTime) {
				return Homey.__('error.could_not_parse');
			}

			const resultIsCurrently = rainTime.first &&
				rainTime.current &&
				(!options.minRain || rainTime.current.indication >= options.minRain) &&
				(!options.maxRain || rainTime.current.indication <= options.maxRain);

			if (options.responseType === 'simple') {
				if (!options.raining) {
					if (rainTime.first) {
						if (!triggers.when) {
							if (rainTime.first.time - options.fromTime <= 10 * 60 * 1000 || options.soon) {
								result.start = Homey.__('yes');
							} else {
								result.start = Homey.__('no_but');
							}
						}
						if (options.rainType) {
							if (!triggers.when) {
								result.rain = Homey.__('no');
							}
							result.rain = Homey.__('rain.no_expected', { rainType: options.rainTypeString });
							if (!resultIsCurrently) {
								result.time = result.time || Homey.__('time.in', { time: this.getTimeDeltaString(rainTime.first.time) });
							}
						} else {
							if (resultIsCurrently) {
								result.rain = Homey.__('dry.currently');
								result.time = '';
							} else {
								result.rain = Homey.__('dry.expected');
								result.time = Homey.__('time.in', { time: this.getTimeDeltaString(rainTime.first.time) });
							}
						}
						const time = this.getTimeDeltaString(
							rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time
						);
						if (rainTime.last) {
							result.end = Homey.__('time.for', { time });
						} else {
							result.end = Homey.__('time.for_atleast', { time });
						}
					} else {
						const invertedRainTime = this.getRainTime(
							rainData,
							this.changeIndicatorBySteps(options.maxRain, 1),
							null,
							options.fromTime,
							options.toTime,
							options.checkInterval
						);
						const rainType = this.getRainTypeString(invertedRainTime);
						if (!triggers.when) {
							result.start = Homey.__('no');
						}
						if (options.fromTime <= Date.now()) {
							result.rain = Homey.__('rain.currently', { rainType });
						} else {
							result.rain = Homey.__('rain.expected', { rainType });
							result.time = result.time || Homey.__('time.in', { time: this.getTimeDeltaString(invertedRainTime.first.time) });
						}
						const time = this.getTimeDeltaString(
							invertedRainTime.last ? invertedRainTime.last.time : rainData[rainData.length - 1].time,
							invertedRainTime.first.time
						);
						if (invertedRainTime.last) {
							result.end = Homey.__('time.last_for', { time });
						} else {
							result.end = Homey.__('time.last_for_atleast', { time });
						}
					}
				} else {
					if (rainTime.first) {
						if (rainTime.current && rainTime.current.indication >= options.minRain && resultIsCurrently) {
							rainTime.first = rainTime.current;
							if (!triggers.when) {
								result.start = Homey.__('yes');
							}
							result.rain = Homey.__('rain.currently', { rainType: `${this.getRainTypeString(rainTime)} ` });
						} else {
							if (!triggers.when) {
								if (rainTime.first.time - options.fromTime <= 10 * 60 * 1000) {
									result.start = Homey.__('yes');
								} else {
									result.start = Homey.__('no_but');
								}
							}
							result.rain = Homey.__('rain.expected', { rainType: `${this.getRainTypeString(rainTime)} ` });
							result.time = result.time || Homey.__('time.in', { time: getTimeDeltaString(rainTime.first.time) });
						}

						const time = this.getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
						if (rainTime.last) {
							result.end = Homey.__('time.last_for', { time });
						} else {
							result.end = Homey.__('time.last_for_atleast', { time });
						}
					} else {
						const invertedRainTime = this.getRainTime(
							rainData,
							Buienradar.rainIndicators.NO_RAIN,
							this.changeIndicatorBySteps(options.minRain, -1),
							options.fromTime,
							options.toTime,
							options.checkInterval
						);
						if (!triggers.when) {
							result.start = Homey.__('no');
						}
						if (options.minRain === Buienradar.rainIndicators.NO_RAIN) {
							result.rain = Homey.__('dry.expected');
						} else {
							result.rain = Homey.__('rain.no_expected', { rainType: options.rainTypeString });
						}
						const time = this.getTimeDeltaString(
							invertedRainTime.last ? invertedRainTime.last.time : rainData[rainData.length - 1].time,
							invertedRainTime.first.time
						);
						if (invertedRainTime.last) {
							result.end = Homey.__('time.for', { time });
						} else {
							result.end = Homey.__('time.for_atleast', { time });
						}
					}
				}
			} else if (options.responseType === 'interval') {
				if (!options.raining) {
					if (rainTime.first &&
						(
							(rainTime.last ? rainTime.last.time.getTime() : rainData[rainData.length - 1].time.getTime()) -
							rainTime.first.time.getTime() + 300000 >= options.checkInterval
						)
					) {
						if (!triggers.when) {
							result.start = Homey.__('yes');
						}
						if (!resultIsCurrently) {
							result.rain = Homey.__('dry.expected');
						} else {
							result.rain = Homey.__('dry.currently');
						}
						result.time = result.time || Homey.__('time.in', { time: this.getTimeDeltaString(rainTime.first.time) });
						const time = this.getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
						if (rainTime.last) {
							result.end = Homey.__('time.for', { time });
						} else {
							result.end = Homey.__('time.for_atleast', { time });
						}
					} else {
						if (!triggers.when) {
							result.startPrefix = Homey.__('no');
						}
						result.rain = Homey.__('dry.will_not');
						const time = this.getTimeDeltaString(new Date(Date.now() + options.checkInterval));
						if (triggers.longer) {
							result.end = Homey.__('time.for_period', { time });
						} else {
							result.end = Homey.__('time.for', { time });
						}
						if (triggers.when) {
							result.end += ` ${Homey.__('time.next_2_hours')}`;
						}
					}
				} else {
					if (rainTime.first &&
						(
							(rainTime.last ? rainTime.last.time.getTime() : rainData[rainData.length - 1].time.getTime()) -
							rainTime.first.time.getTime() + 300000 >= options.checkInterval
						)
					) {
						if (!triggers.when) {
							result.start = Homey.__('yes');
						}
						if (resultIsCurrently) {
							result.rain = Homey.__('rain.currently', { rainType: `${this.getRainTypeString(rainTime)} ` });
						} else {
							result.rain = Homey.__('rain.expected', { rainType: `${this.getRainTypeString(rainTime)} ` });
							result.time = result.time || Homey.__('time.in', { time: this.getTimeDeltaString(rainTime.first.time) });
						}
						const time = this.getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
						if (rainTime.last) {
							result.end = Homey.__('time.last_for', { time });
						} else {
							result.end = Homey.__('time.last_for_atleast', { time });
						}
					} else {
						if (!triggers.when) {
							result.start = Homey.__('no');
						}
						result.rain = Homey.__('rain.will_be_no', { rainType: options.rainTypeString });
						const time = this.getTimeDeltaString(new Date(Date.now() + options.checkInterval));
						if (triggers.longer) {
							result.end = Homey.__('time.for_longer', { time });
						} else {
							result.end = Homey.__('time.for_period', { time });
						}
						if (triggers.when) {
							result.end += Homey.__('time.next_2_hours');
						}
					}
				}
			} else if (options.responseType === 'umbrella') {
				const rainList = [rainTime];
				while (rainList[rainList.length - 1].last) {
					rainList.push(
						this.getRainTime(rainData, options.minRain, options.maxRain, rainList[rainList.length - 1].last.time + 1, null, options.checkInterval)
					);
				}
				if (rainList.length === 1) {
					if (rainList[0].first) {
						const rain = rainList[0];
						const totalTime = (rain.last ? rain.last.time : rainData[rainData.length - 1].time) - rain.first.time;
						if (totalTime > 30 * 60 * 1000) {
							result.start = Homey.__('umbrella.should', { umbrella: options.umbrella });
						} else if (totalTime > 10 * 60 * 1000 || rain.max.indication >= Buienradar.rainIndicators.HEAVY_RAIN) {
							result.start = Homey.__('umbrella.could', { umbrella: options.umbrella });
						} else {
							result.start = Homey.__('umbrella.shouldnt', { umbrella: options.umbrella });
						}
						if (resultIsCurrently) {
							result.rain = Homey.__('rain.currently', { rainType: this.getRainTypeString(rain) });
						} else {
							result.rain = Homey.__('rain.expected', { rainType: this.getRainTypeString(rain) });
							result.time = result.time || Homey.__('time.in', { time: this.getTimeDeltaString(rain.first.time) });
						}
						const time = this.getTimeDeltaString((rain.last ? rain.last.time : rainData[rainData.length - 1].time), rain.first.time);
						if (rain.last) {
							result.end = Homey.__('time.last_for', { time });
						} else {
							result.end = Homey.__('time.last_for_atleast', { time });
						}
					} else {
						result.start = Homey.__('umbrella.dont', { umbrella: options.umbrella });
						result.rain = Homey.__('dry.expected');
						result.end = Homey.__('time.for_atleast', { time: this.getTimeDeltaString(rainData[rainData.length - 1].time, options.fromTime) });
					}
				} else {
					const rain = rainList[0];
					let totalTime = 0;
					rainList.forEach(rainItem => {
						if (rainItem.first) {
							totalTime += (rainItem.last ? rainItem.last.time : rainData[rainData.length - 1].time) - rainItem.first.time;
						}
						if (rainItem.min && rain.min.indication > rainItem.min.indication) {
							rain.min = rainItem.min;
						} else if (rainItem.max && rain.max.indication < rainItem.max.indication) {
							rain.max = rainItem.max;
						}
					});

					if (totalTime > 30 * 60 * 1000) {
						result.start = Homey.__('umbrella.should', { umbrella: options.umbrella });
					} else if (totalTime > 10 * 60 * 1000 || rain.max.indication >= Buienradar.rainIndicators.HEAVY_RAIN) {
						result.start = Homey.__('umbrella.could', { umbrella: options.umbrella });
					} else {
						result.start = Homey.__('umbrella.shouldnt', { umbrella: options.umbrella });
					}

					result.rain = Homey.__('rain.showers', {
						amount: rainList.length,
						time: this.getTimeDeltaString(rainData[rainData.length - 1].time, options.fromTime).replace(/^1\s/, ''),
					});
					if (resultIsCurrently) {
						result.time = Homey.__('time.started');
					} else {
						result.time = Homey.__('time.starting', { time: this.getTimeDeltaString(rain.first.time) });
					}
					result.end = Homey.__('time.combined', { time: this.getTimeDeltaString(Date.now() + totalTime) });
				}
			}

			let response = '';
			Object.keys(result).forEach(key => {
				if (result[key]) {
					response += `${result[key]} `;
				}
			});
			response = response.charAt(0).toUpperCase() + response.slice(1);
			return response;
		}).catch(err => {
			console.log('error in speech request', err, err.stack);
			throw err;
		});
	}

	getTimeAfterIndex(speech, index, before) {
		if (speech.time) {
			if (before) {
				return speech.time
					.sort((a, b) => b.index - a.index)
					.find(time => time.index <= index || (time.index <= index && time.index + time.transcript.length >= index));
			}
			return speech.time
				.find(time => time.index >= index || (time.index <= index && time.index + time.transcript.length >= index));
		}
		return null;
	}

	getTimeDeltaString(timeA, timeB) {
		if (typeof timeA !== 'number' && (!timeA || timeA.constructor.name !== 'Date')) {
			return null;
		}
		timeB = timeB || Date.now();

		const delta = Math.round(Math.abs(timeA - timeB) / 60000);
		const hourCount = Math.floor(delta / 60);
		const minuteCount = delta % 60;
		const hours = hourCount ? Homey.__(`time_units.hour${hourCount === 1 ? '' : 's'}`, { amount: hourCount }) : false;
		const minutes = minuteCount ? Homey.__(`time_units.minute${minuteCount === 1 ? '' : 's'}`, { amount: minuteCount }) : false;
		if (hours) {
			if (minutes) {
				return Homey.__('time_units.time', { hours, minutes });
			}
			return hours;
		}
		return minutes;
	}

	getRainIndicationFromTrigger(trigger) {
		if (trigger.id === 'light') {
			return Buienradar.rainIndicators.LIGHT_RAIN;
		} else if (trigger.id === 'moderate') {
			return Buienradar.rainIndicators.MODERATE_RAIN;
		} else if (trigger.id === 'heavy') {
			return Buienradar.rainIndicators.HEAVY_RAIN;
		} else if (trigger.id === 'violent') {
			return Buienradar.rainIndicators.VIOLENT_RAIN;
		}
		return null;
	}

	getRainIndicationString(indication) {
		switch (indication) {
			case Buienradar.rainIndicators.NO_RAIN:
				return Homey.__('indicator.no');
			case Buienradar.rainIndicators.LIGHT_RAIN:
				return Homey.__('indicator.light');
			case Buienradar.rainIndicators.MODERATE_RAIN:
				return Homey.__('indicator.moderate');
			case Buienradar.rainIndicators.HEAVY_RAIN:
				return Homey.__('indicator.heavy');
			case Buienradar.rainIndicators.VIOLENT_RAIN:
				return Homey.__('indicator.violent');
			default:
				return null;
		}
	}

	changeIndicatorBySteps(indicator, posChange) {
		const indicators = Object.keys(Buienradar.rainIndicators);
		const index = Math.max(Math.min(indicators.findIndex(key => Buienradar.rainIndicators[key] === indicator) + posChange, indicators.length - 1), 0);
		return Buienradar.rainIndicators[indicators[index]];
	}

	getRainTime(rainData, minRain, maxRain, fromTime, toTime, checkFor) {
		checkFor = checkFor || 5 * 60 * 1000;
		minRain = !isNaN(minRain) ? minRain : Buienradar.rainIndicators.LIGHT_RAIN;
		let checkedRain = false;
		const result = {};
		rainData.forEach(data => {
			if (data.time < Date.now()) {
				result.current = data;
			} else if ((!fromTime || data.time > fromTime) && (!toTime || data.time < toTime)) {
				checkedRain = true;
				if (!result.first && data.indication >= minRain && (!maxRain || data.indication <= maxRain)) {
					result.first = data;
					result.rain = data;
					result.min = data;
					result.max = data;
				} else if (result.first) {
					if (data.time - result.first.time <= checkFor) {
						if ((maxRain && data.indication > maxRain) || (minRain && data.indication < minRain)) { // 5 min no rain !== no rain
							result.first = null;
							result.rain = null;
							result.min = null;
							result.max = null;
							result.last = null;
						} else if (result.rain && data.indication > result.rain.indication && !maxRain || data.indication <= maxRain) {
							result.rain = data;
						}
					}
				}
			}
			if (result.first && !result.last) {
				if ((minRain && data.indication < minRain) || (maxRain && data.indication > maxRain)) {
					result.last = data;
				}
				if ((!result.min || ((!minRain || data.indication >= minRain) && result.min.indication > data.indication))) {
					result.min = data;
				}
				if (!result.max || ((!maxRain || data.indication <= maxRain) && result.max.indication < data.indication)) {
					result.max = data;
				}
			}
		});
		if (!result.current && result.first && result.first.time - 5 * 60 * 1000 < Date.now()) {
			result.current = result.first;
		}
		return checkedRain ? result : false;
	}

	getRainTypeString(rainTimeData) {
		if (!rainTimeData.rain) {
			return 'no';
		}
		return `${getRainIndicationString(rainTimeData.min.indication)}
	    ${rainTimeData.min.indication !== rainTimeData.max.indication ? ` to ${getRainIndicationString(rainTimeData.max.indication)}` : ''}
	    `;
	}
}

module.exports = SpeechManager;
