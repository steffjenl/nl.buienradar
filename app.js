'use strict';

const Homey = require('homey');
const Buienradar = require('./lib/buienradar');
const RAIN_THRESHOLD = 0.2;
const MINUTE = 60000;

class BuienradarApp extends Homey.App {
    async onInit() {
        this.rainingState = null;
        this.rainStopTriggered = false;
        this.rainStartTriggered = false;

        this.resetBuienRadarAPI();
        Homey.ManagerGeolocation.on('location', this.resetBuienRadarAPI.bind(this));

        this.initSpeech();
        this.initFlows();

        this.poll();

        setInterval(this.poll.bind(this), 6 * MINUTE);

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

            forecasts = this.trimForecasts(forecasts);

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

            });
        this.dryInTrigger = new Homey.FlowCardTrigger('dry_in').register()
            .registerRunListener((args, state) => {

            });

        this.rainCondition = new Homey.FlowCardCondition('is_raining').register()
            .registerRunListener(async (args, state) => {
                return this.rainingState;
            });
        this.rainInCondition = new Homey.FlowCardCondition('raining_in').register()
            .registerRunListener(async (args, state) => {
                let time = this.addMinutesToTime(new Date(), args.when);
                return await this.checkRainAtTime(time);
            });
    }

    checkIfRaining(forecast) {
        return forecast.mmh >= RAIN_THRESHOLD;
    }

    trimForecasts(forecasts) {
        let trimmed = forecasts.slice(0, 4);
        trimmed.push(forecasts[6]);
        trimmed.push(forecasts[9]);
        trimmed.push(forecasts[12]);
        trimmed.push(forecasts[18]);
        trimmed.push(forecasts[23]);

        return trimmed;
    }

    async poll() {
        // Check if it is raining at this moment
        let forecasts = null;

        try {
            forecasts = await this.api.getForecasts();
        } catch (e) {
            forecasts = await this.api.getForecastsInsecure();
        }

        forecasts = this.trimForecasts(forecasts);
        let rainState = this.checkIfRaining(forecasts[0]);

        this.log('==========================');
        this.log('RAIN STATE DATA CURRENTLY:');
        this.log('==========================');
        this.log(`SAVED RAIN STATE: ${this.rainingState}`);
        this.log(`RAINING NOW: ${rainState}`);

        if (this.rainingState === null) {
            this.rainingState = rainState;
        } else if (!rainState && this.rainingState === true) {
            this.rainingState = false;
            this.log(`TRIGGERING FLOW RAIN STOP`);
            this.rainStopTrigger.trigger();
        } else if (rainState && this.rainingState === false) {
            this.rainingState = true;
            this.log(`TRIGGERING FLOW RAIN START`);
            this.rainStartTrigger.trigger();
        }

        this.log('==========================');
        this.log('RAIN DATA IN THE FUTURE:');
        this.log('==========================');
        // Loop over possibilities for rain starting or stopping in the next 120 minutes
        for (let i = 1; i < forecasts.length; i++) {
            let inMinutes = 0;
            switch (i) {
                case 1: inMinutes = 5; break;
                case 2: inMinutes = 10; break;
                case 3: inMinutes = 15; break;
                case 4: inMinutes = 30; break;
                case 5: inMinutes = 45; break;
                case 6: inMinutes = 60; break;
                case 7: inMinutes = 90; break;
                case 8: inMinutes = 110; break;
            }

            let rainState = this.checkIfRaining(forecasts[i]);
            this.log(`RAINING IN ${inMinutes} MINUTES: ${rainState}`);

            if (!rainState && this.rainingState === true && this.rainStopTriggered === false) {
                this.log(`TRIGGERING FLOW RAIN STOP IN: ${inMinutes} Minutes`);
                this.dryInTrigger.trigger(null, {when: inMinutes.toString()});

                this.rainStopTriggered = true;
                setTimeout(() => {
                    this.rainStopTriggered = false;
                }, inMinutes * MINUTE);
            }
            else if (rainState && this.rainingState === false && this.rainStartTriggered === false) {
                this.log(`TRIGGERING FLOW RAIN START IN: ${inMinutes} Minutes`);
                this.rainInTrigger.trigger(null, {when: inMinutes.toString()});

                this.rainStartTriggered = true;
                setTimeout(() => {
                    this.rainStartTriggered = false;
                }, inMinutes * MINUTE);
            }
        }

        this.log('==========================\n\n');
    }
}

module.exports = BuienradarApp;
