'use strict';

const Homey = require('homey');
const Buienradar = require('buienradar');
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
            let now = await this.checkRainAtTime();
            let halfHour = this.addMinutesToTime(new Date(), 30);
            let future = await this.checkRainAtTime(halfHour);

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

    addMinutesToTime(time, minutes) {
        return new Date(time.getTime() + minutes * 60000);
    }

    async checkRainAtTime(time = new Date()) {
        try {
            let result = await this.api.getNextForecast({after: time});
            return result.mmh > RAIN_THRESHOLD;
        } catch (e) {
            this.error(e);
        }
    }

    async poll() {
        // Check if it is raining at this moment
        let now = new Date();
        let rainState = await this.checkRainAtTime(now);

        this.log(`CHECKING CURRENT STATE: Rainstate: ${this.rainingState}, raining now: ${rainState}`);

        if (this.rainingState === null) {
            this.rainingState = rainState;
        } else if (!rainState && this.rainingState === true) {
            this.rainingState = false;
            this.log(`TRIGGERING FLOW STOP: Time: ${now}, raining: ${rainState}`);
            this.rainStopTrigger.trigger();
        } else if (rainState && this.rainingState === false) {
            this.rainingState = true;
            this.log(`TRIGGERING FLOW START: Time: ${now}, raining: ${rainState}`);
            this.rainStartTrigger.trigger();
        }

        // Loop over possibilities for rain starting or stopping in the next 120 minutes
        for (let i = 0; i < 8; i++) {
            let inMinutes = 0;
            switch (i) {
                case 0: inMinutes = 5; break;
                case 1: inMinutes = 10; break;
                case 2: inMinutes = 15; break;
                case 3: inMinutes = 30; break;
                case 4: inMinutes = 45; break;
                case 5: inMinutes = 60; break;
                case 6: inMinutes = 90; break;
                case 7: inMinutes = 110; break;
            }

            let atTime = this.addMinutesToTime(now, inMinutes);
            let rainState = await this.checkRainAtTime(atTime);

            this.log(`CHECKING STATE IN ${inMinutes} MINUTES: Rainstate: ${this.rainingState}, raining then: ${rainState}`);

            if (!rainState && this.rainingState === true && this.rainStopTriggered === false) {
                this.log(`TRIGGERING FLOW STOP IN: Time: ${atTime}, raining: ${rainState}`);
                this.dryInTrigger.trigger(null, {when: inMinutes.toString()});

                this.rainStopTriggered = true;
                setTimeout(() => {
                    this.rainStopTriggered = false;
                }, inMinutes * MINUTE);
            }
            else if (rainState && this.rainingState === false && this.rainStartTriggered === false) {
                this.log(`TRIGGERING FLOW START IN: Time: ${atTime}, raining: ${rainState}`);
                this.rainInTrigger.trigger(null, {when: inMinutes.toString()});

                this.rainStartTriggered = true;
                setTimeout(() => {
                    this.rainStartTriggered = false;
                }, inMinutes * MINUTE);
            }
        }
    }
}

module.exports = BuienradarApp;
