'use strict';

const Homey = require('homey');
const Buienradar = require('./lib/buienradar');
const RAIN_THRESHOLD = 0.1;
const MINUTE = 60000;
const timeMap = {
    0: 0,
    1: 5,
    2: 10,
    3: 15,
    4: 30,
    5: 45,
    6: 60,
    7: 90,
    8: 120
};

class BuienradarApp extends Homey.App {
    async onInit() {
        this.isRaining = null;

        this.resetBuienRadarAPI();
        Homey.ManagerGeolocation.on('location', this.resetBuienRadarAPI.bind(this));

        this.initSpeech();
        this.initFlows();

        this.poll();

        setInterval(this.poll.bind(this), 5 * MINUTE);

        this.log('Buienradar is running...');
    }

    resetBuienRadarAPI() {
        let latitude = Homey.ManagerGeolocation.getLatitude();
        let longitude = Homey.ManagerGeolocation.getLongitude();

        this.api = new Buienradar({ lat: latitude, lon: longitude });
    }

    initSpeech() {
        Homey.ManagerSpeechInput.on('speechEval', (speech, callback) => {
            callback(null, speech.matches.main);
        });

        Homey.ManagerSpeechInput.on('speechMatch', async (speech, onSpeechEvalData) => {
            let speechResponse = '';
            let forecasts = null;

            try {
                forecasts = await this.api.getForecasts();
            } catch (e) {
                forecasts = await this.api.getForecastsInsecure();
            }

            if (!forecasts) return;
            forecasts = this.parseForecast(forecasts);

            let now = this.checkIfRaining(forecasts[0]);
            let future = this.checkIfRaining(forecasts[4]);

            if (now && future) speechResponse = Homey.__("rain_now_rain_future");
            else if (now && !future) speechResponse = Homey.__("rain_now_no_rain_future");
            else if (!now && future) speechResponse = Homey.__("no_rain_now_rain_future");
            else if (!now && !future) speechResponse = Homey.__("no_rain_now_no_rain_future");

            speech.say(speechResponse);
        });
    }

    initFlows() {
        this.rainStartTrigger = new Homey.FlowCardTrigger('rain_start').register();
        this.rainStopTrigger = new Homey.FlowCardTrigger('rain_stop').register();

        this.rainInTrigger = new Homey.FlowCardTrigger('raining_in').register()
            .registerRunListener((args, state) => {
                if (args.when === state.when) return true
                else return false;
            });
        this.dryInTrigger = new Homey.FlowCardTrigger('dry_in').register()
            .registerRunListener((args, state) => {
                if (args.when === state.when) return true
                else return false;
            });

        this.rainCondition = new Homey.FlowCardCondition('is_raining').register()
            .registerRunListener(async (args, state) => {
                return this.isRaining;
            });
        this.rainInCondition = new Homey.FlowCardCondition('raining_in').register()
            .registerRunListener(async (args, state) => {
                let forecast = await this.getForecast();

                // Select the forecast we need
                forecast = forecast[args.when];
                return this.checkIfRaining(forecast);
            });
    }

    checkIfRaining(forecast) {
        return forecast >= RAIN_THRESHOLD;
    }

    async getForecast() {
        // Get forecast object containing 0 - 120 minutes of rain data
        let forecast = null;
        try {
            forecast = await this.api.getForecasts();
        } catch (e) {
            forecast = await this.api.getForecastsInsecure();
        }
        if (!forecast || forecast.length === 0) return new Error('Could not obtain forecasts');
        return this.parseForecast(forecast);
    }

    parseForecast(forecast) {
        let trimmed = forecast.slice(0, 4);
        trimmed.push(forecast[6]);
        trimmed.push(forecast[9]);
        trimmed.push(forecast[12]);
        trimmed.push(forecast[18]);
        trimmed.push(forecast[23]);

        let parsed = {};
        for (let i = 0; i < trimmed.length; i++) {
            parsed[timeMap[i]] = trimmed[i].mmh
        }

        return parsed;
    }

    async poll() {
        let forecast = await this.getForecast();

        let lastRainingState = null;

        for (let when in forecast) {
            if (forecast.hasOwnProperty(when)) {
                const raining = this.checkIfRaining(forecast[when]);

                this.log(`Forecast for: ${when}m rain: ${forecast[when]}mm`);

                if (this.isRaining !== raining && when === '0') {
                    if (raining) {
                        this.log('Raining started: NOW');
                        this.rainStartTrigger.trigger();
                    }
                    else {
                        this.log('Raining stopped: NOW');
                        this.rainStopTrigger.trigger();
                    }
                    this.isRaining = raining;
                } else if (raining !== lastRainingState && when !== '0') {
                    if (raining) {
                        this.log(`Rain is coming in ${when} minutes`);
                        this.rainInTrigger.trigger(null, {when});
                    }
                    else {
                        this.log(`Rain is ending in ${when} MINUTES`);
                        this.dryInTrigger.trigger(null, {when});
                    }
                }

                lastRainingState = raining;
            }
        }
    }
}

module.exports = BuienradarApp;
