"use strict";

var difMinute;
var lat;
var lon;
var cache;
var rainInfo = {};
var specificRainInfo = {};

var self = module.exports;

// this `init` function will be run when Homey is done loading
module.exports.init = function(){
    Homey.log("Buienradar app started");

    //Get location
    self.getLocation( function( lat, lon ) {} )  //Get the location

    //Update weather after 5 seconds and every 5 minutes
    setTimeout(function () {
        self.updateWeather( function(difMinute){});
    }, 2000)
    setInterval(trigger_update.bind(this), 1000 * 10 *5); //1000 * 60 * 5
    function trigger_update() {
      self.updateWeather( function(difMinute){});
    };

    //Listen for speech triggers
    Homey.manager('speech-input').on('speech', self.onSpeech)
};

//Listen for speech
module.exports.onSpeech = function(speech) {
        Homey.log("Speech is triggered");

        var spoken_text;
        var format;

        var options = { rain: null,
                        when: null,
                        whenRelative: null,
                        intensity: null,
                        speechContains: []
                      };

        speech.triggers.forEach(function(trigger){ //Listen for triggers

            //Find numbers
            var numbers = speech.transcript.match(/\d+/);      
            if( Array.isArray( numbers ) ) {
              var number = numbers[0];
                number = parseInt(number);
                
              if( !isNaN( number ) ) {
                if( number > 0 && number <= 120 ) {
                  options['when'] = number;
                } else if( number > 120) {
                  Homey.manager('speech-input').ask( __("only_two_hours"), function( err, result ){
                     if( err ) {
                          Homey.error( err );
                          return;
                      }
                      onSpeech(result);
                  });
                }
              }
            }

            if ( trigger.id == 'rain' ) {
                options['rain'] = true;
            } else if ( trigger.id == 'no') {
                options['rain'] = false;
            }

            if ( trigger.id == 'now' ) {
                options['when'] = 0;
            } else if ( trigger.id == 'quarter' ) {
                options['when'] = 15;
            } else if ( trigger.id == 'half_hours' ) {
                options['when'] = 30;
            } else if ( trigger.id == 'hour' ) {
                options['when'] = 60;
            } else if ( trigger.id == 'two_hours' ) {
                options['when'] = 120;
            }

            if ( trigger.id == 'at' ) {
                options['whenRelative'] = 'at';
            } else if (trigger.id == 'before') {
                options['whenRelative'] = 'before';
            } else if ( trigger.id == 'after' ) {
                options['whenRelative'] = 'after';
            } 

            if ( trigger.id == 'light' ) {
                options['intensity'] = 0;
            } else if ( trigger.id == 'moderate' ) {
                options['intensity'] = 85;
            } else if ( trigger.id == 'heavy' ) {
                options['intensity'] = 255;
            } 

            if ( trigger.id == 'when' ) {
                options['speechContains'].push.apply(options['speechContains'], ['when']);
            } else if ( trigger.id == 'start' ) {
                options['speechContains'].push.apply(options['speechContains'], ['start']);
            } else if ( trigger.id == 'stop' ) {
                options['speechContains'].push.apply(options['speechContains'], ['stop']);
            } else if ( trigger.id == 'no' ) {
                options['speechContains'].push.apply(options['speechContains'], ['no']);
            } 
            
        });

        Homey.log ("spoken_text: " + speech.transcript);
        if (cache == null) {
            setTimeout( function() {module.exports.speakWeather( options );}, 5000) //If no weather update yet, what 5 sec
            Homey.log("Please wait, Homey is getting the buienradar info")
        } else {
            module.exports.speakWeather( options ); //ask_rain, ask_when
        }
}

//get location
module.exports.getLocation = function( locationCallback ) {
    Homey.log("Get geolocation");

    Homey.manager('geolocation').on('location', function (location) {
    lat = location.latitude;
    lon = location.longitude;
    } )

    Homey.manager('geolocation').getLocation(function(err, location) {
        if( typeof location.latitude == 'undefined' || location.latitude == 0 ) {
            locationCallback( new Error("location is undefined") );
            return;
        } else {
            Homey.log( location );
            lat = location.latitude;
            lon = location.longitude;

            locationCallback(lat, lon);
        }
    });
};

// update the weather
module.exports.updateWeather = function( callback ) {
    Homey.log("Update Weather");

        cache = {} //Clear rainInfo
        rainInfo = {} //Clear rainInfo

        if (lat == undefined) { //if no location, try to get it
            self.getLocation( function( lat, lon ) {  //Get the location, could be that location is not available yet after reboot
            })
        }

        //Change UTC to localtime
        /*var d = new Date();
        var offset = (new Date().getTimezoneOffset() / 60) * -1; //offset in hours from UTC
        var localhours = d.getHours() + offset; */

          var request = require('request');
          request('http://gps.buienradar.nl/getrr.php?lat=' + lat + '&lon=' + lon, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            //var array = "000|18:45,000|18:50,000|18:55,000|19:00,000|19:05,000|19:10,000|19:15,000|19:20,000|19:25,000|19:30,000|19:35,000|19:40,000|19:45,000|19:50,000|19:55,080|20:00,070|20:05,060|20:10,000|20:15,000|20:20,000|20:25,000|20:30,000|20:35,000|20:40,000|20:45";
            //var array = array.split(','); //Enable this line again when using testing string isntead of the real weather
            var array = body.split('\r\n'); //split into seperate items

            Homey.log ("Array: " + array);
            //Homey.log ("Lat: " + lat);
            //Homey.log ("Lon: " + lon);

            var rain_found;
            var rainTotal = 0;
            var rainAverage = 0;
            var rainEntrys = 0;
            var firstEntry;
            var firstDifMinute;

            for (var i = 2; i < 24; i++) { //get the coming 60 min (ignore first 2 items) (12 x 5 = 60)
                var array2 = array[i].split('|'); //split rain and time
                    var rainMm = parseInt(array2[0]); //Take mm and make it a int
                    var rainTime = array2[1];
                    var rainMinute = parseInt(rainTime.substr(rainTime.indexOf(":") + 1));
                    var rainHours = parseInt(rainTime.substr(rainTime.indexOf(":") - 2, 2));
                    var d = new Date();
                    var hours = d.getHours();
                    var currentMinute = d.getMinutes();

                    //Homey.log('hour check', hours, rainHours);

                    hours = parseInt(hours) + 2;

                    if (hours == rainHours) {
                        difMinute = rainMinute - currentMinute;
                    }
                    else if (hours + 1 == rainHours) {
                        difMinute = 60 - currentMinute + rainMinute;
                    } else if (hours + 2 == rainHours) {
                        difMinute = 120 - currentMinute + rainMinute;
                    }

                    if (difMinute < 0) difMinute = 0; //Make a int that is just below 0 a 0

                    if (firstEntry !== false) {
                        firstDifMinute = difMinute;
                        firstEntry = false;
                    }

                    //Homey.log('difMinute', difMinute);

                    rainTotal = rainTotal + rainMm;
                    rainEntrys = rainEntrys + 1;
                    //rain_found = true;

                var rainMm = parseInt(array2[0]); //Take mm and make it a int
                var rainTime = array2[1];

                rainInfo[ difMinute ] = { //Extend the existing object with the new device
                    mm: rainMm
                };

                cache = rainInfo;

                //Homey.log(cache);
            }
          }
      }.bind(this));
};

module.exports.speakWeather = function( options ){
    Homey.log("speakWeather");

    var rainInfo = cache;
    var mm;
    var rainFound;
    var dryFound;
    var rainTotal = 0;
    var rainAverage = 0;
    var rainEntrys = 0;
    var start;
    var stop;
    var found = false;
    var noRain;
    var output;
    var rainIntensity;
    var yesNo;

    Homey.log(arguments);

    for (var time in rainInfo) {
        var mm = (rainInfo[time].mm); //Rain
        if (options.when == null) { //If no time specified, get everything
            specificRainInfo[ time ] = { //fill the specificRainInfo object with the specific requested information
                mm: mm
            };
            rainTotal = rainTotal + mm;
            if (mm > 0) rainEntrys = rainEntrys + 1;
            //Homey.log("not time");
        } else if (options.whenRelative == 'at' || options.when == 0) {
            if (time == options.when) {
                specificRainInfo[ time ] = { //fill the specificRainInfo object with the specific requested information
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                Homey.log("at");
            }
        } else if (options.whenRelative == 'before' || options.whenRelative == null) { //If before or not defined
            if (time <= options.when) {
                specificRainInfo[ time ] = { //fill the specificRainInfo object with the specific requested information
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                Homey.log("before");
            }
        } else if (options.whenRelative == 'after') {
            if (time >= options.when) {
                specificRainInfo[ time ] = { //fill the specificRainInfo object with the specific requested information
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                Homey.log("after");
            }
        }
    }

    Homey.log(typeof rainTotal, rainTotal, typeof rainEntrys, rainEntrys)

    if (rainEntrys != 0) {
        rainAverage = rainTotal / rainEntrys;
    }

    Homey.log("rainAverage", rainAverage)
    Homey.log(specificRainInfo);

    for (var time in specificRainInfo) {
        var mm = (specificRainInfo[time].mm); //Rain
        //Homey.log('time', time, 'mm', mm, 'options', options)

        if (mm > 0) { //It contains rain
            if (options.intensity == null) { //No certain intensity
                if (found == false) { start = time; found = true };
                stop = time;
                Homey.log("It will rain without intensity!")
            } else if (options.intensity < mm) { //Certain intensity
                if (found == false) { start = time; found = true };
                stop = time;
                Homey.log("It will rain that hard!")
            }
        }
        if (mm == 0) { //No rain
            Homey.log("It wil stay dry");
        }
    }

    Homey.log('rainAverage', rainAverage)

    if (rainAverage == 0) rainIntensity = __("no");
    if (rainAverage < 85) rainIntensity = __("light");
    if (rainAverage > 85 && rainAverage < 255) rainIntensity = __("moderate");
    if (rainAverage > 255) rainIntensity = __("heavy");

    if (rainAverage == 0) {yesNo = __("no")};
    if (rainAverage > 0) {yesNo = __("yes")};
    if (rainAverage == 0 && options.rain == false) {yesNo = __("yes")};
    if (rainAverage > 0 && options.rain == false) {yesNo = __("no")};

    //When a not turn the YesNo around
    if (options.speechContains.indexOf("no") > -1) {if (yesNo == __("yes")){yesNo = __("no")} else if (yesNo == __("no")){yesNo = __("yes")} };

    Homey.log('options.when', options.when);

    if (options.when == null) options.when = '2 ' + __("hours"); 
    if (options.when < 120) options.when = options.when + " " + __("minutes");
    if (options.when == 120) options.when = '2 ' + __("hours"); 
    if (options.when == 60) options.when = '1 ' + __("hour"); 
    if (options.when == 1) options.when = options.when + " " + __("minutes"); 
    if (options.when == 0) options.when = __("now");
    if (options.whenRelative == null) options.whenRelative = __("whitin"); //By default it is within
    if (options.whenRelative == "before") options.whenRelative = __("before"); 
    if (options.whenRelative == "after") options.whenRelative = __("after"); 
    if (options.whenRelative == "at") options.whenRelative = __("at");
    if (options.speechContains.indexOf("when") > -1) yesNo = ""; //Don't say Yes or No when user asks for when

    if (options.speechContains.indexOf("start") > -1 && start != null) {
        output = __("start_rain", { "yesNo": yesNo, "options.when": options.when } );
    } else if (options.speechContains.indexOf("stop") > -1 && stop != null) {
        output = __("stop_rain", { "yesNo": yesNo, "options.when": options.when } );
    } else if (options.speechContains.indexOf("start") > -1 && start == null) {
        output = __("not_start_rain", { "yesNo": yesNo, "options.when": options.when } );
    } else if (options.speechContains.indexOf("stop") > -1 && stop == null && rainAverage > 0) {
        output = __("not_stop_rain", { "yesNo": yesNo, "options.when": options.when } );
    } else if (rainAverage >= 1) {
        output = __("rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } )
    } else if (rainAverage == 0) {
        output = __("no_rain", { "yesNo": yesNo, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    }

    Homey.log("Homey say: " + output);
    //Homey.manager('speech-output').say( __(output) );
};