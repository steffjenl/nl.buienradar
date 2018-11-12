'use strict';

const Homey = require('homey');
const Buienradar = require('buienradar');

class BuienradarApp extends Homey.App {
    async onInit() {
        this.rainingState = null;

        let latitude = Homey.ManagerGeolocation.getLatitude();
        let longitude = Homey.ManagerGeolocation.getLongitude();

        this.api = new Buienradar({ lat: latitude, lon: longitude });

        this.initSpeech();
        this.initFlows();
        setInterval(this.poll.bind(this), 10000);

        this.log('Buienradar is running...');
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
                return await this.checkRainAtTime();
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

    calculateTimeDifference(before, after) {
        let difference = after.getTime() - before.getTime();
        return Math.ceil(difference / (60000));
    }

    async checkRainAtTime(time = new Date()) {
        let result = await this.api.getNextForecast({after: time});
        return result.mmh > 0.2;
    }

    async poll() {
        let now = new Date();
        let results = await this.api.getForecasts();

        for (let i = 0; i < results.length; i++) {
            let result = results[i];
            let timeDiff = this.calculateTimeDifference(now, new Date(result.date));

            if (0 <= timeDiff <= 5) {
                if (this.rainingState === null) {
                    this.rainingState = result.mmh > 0.2;
                } else if (result.mmh <= 0.2 && this.rainingState === true) {
                    this.rainingState = false;
                    this.rainStopTrigger.trigger();
                } else if (result.mmh > 0.2 && this.rainingState === false) {
                    this.rainingState = true;
                    this.rainStartTrigger.trigger();
                }
            }

            else if (0 <= timeDiff && result.mmh <= 0.2) {
                this.dryInTrigger.trigger(null, {when: timeDiff.toString()});
            } else if (0 <= timeDiff && result.mmh > 0.2) {
                this.rainInTrigger.trigger(null, {when: timeDiff.toString()});
            }
        }
    }
}

module.exports = BuienradarApp;
