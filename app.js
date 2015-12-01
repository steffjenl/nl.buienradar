"use strict";

var difMinute;
var lat = null;
var lon = null;
var language;
var cache;
var rainInfo = {};
var specificRainInfo = {};

var self = module.exports;

// this `init` function will be run when Homey is done loading
module.exports.init = function(){
    Homey.log("Buienradar app started");

    //Get location
    self.getLocation( function (){})  //Get the location

    //Get language
    language = Homey.manager( 'i18n' ).getLanguage();

    //Update weather after 5 seconds and every 5 minutes
    setTimeout(function () {
        self.updateWeather( function(difMinute){});
    }, 2000)
    setInterval(trigger_update.bind(this), 300000);
    function trigger_update() {
      self.updateWeather( function(difMinute){});
    };

    //Listen for speech triggers
    Homey.manager('speech-input').on('speech', self.onSpeech)

    //Listen for triggers with time involved
    Homey.manager('flow').on('trigger.raining_in', self.raining_in)

    //Listen for triggers it is raining
    Homey.manager('flow').on('condition.is_raining', self.is_raining)
};

//Check for triggers with time involved
module.exports.raining_in = function( callback, args) {
    Homey.log("triggers.raining_in")
    Homey.log(args);

    var found = false;

    if (args.when != "") {
        for (var time in cache) {
            var rainMm = cache[ time ].mm;

            if (time <= parseInt(args.when) && rainMm > 0) {
                //Homey.log("True" + time);
                found = true;
            }
        }
    }

    if (found == true) {
        callback(true);
    } else {
        callback(false);
    }
}

//Check for triggers with time involved
module.exports.is_raining = function( callback, args) {
    Homey.log("condition.is_raining")
    Homey.log(args);
    Homey.log(cache);

    var found = false;

    for (var time in cache) {
        var rainMm = cache[ time ].mm;

        if (time <= 5 && rainMm > 0) {
            Homey.log("True" + time);
            found = true;
        }
    }

    if (found == true) {
        callback(true);
    } else {
        callback(false);
    }
}

//Listen for speech
module.exports.onSpeech = function(speech) {
        Homey.log("Speech is triggered");

        var options = { rain: null,
                        when: null,
                        whenRelative: null,
                        intensity: null,
                        speech: speech.transcript
                      };

        Homey.log(speech.transcript);

        var s = speech.transcript;

        if (s.indexOf (__("today")) > -1 || s.indexOf(__("tomorrow")) > -1 || s.indexOf(__("morning")) > -1 || s.indexOf(__("afternoon")) > -1 || s.indexOf(__("evening")) > -1) { //If you want to know hours or minutes
            Homey.manager('speech-input').ask( __("only_two_hours"), function( err, result ){
                if( err ) {
                    Homey.error( err );
                    return;
                }
                self.onSpeech(result);
            });

        } else {
            speech.triggers.forEach(function(trigger){ //Listen for triggers
                if ( trigger.id == 'minute' || trigger.id == 'hour' ) {
                Homey.log("Trying to find numbers");
                //Find numbers
                var numbers = speech.transcript.match(/\d+/);      
                    if( Array.isArray( numbers ) ) {
                        var number = numbers[0];

                        if (trigger.id == 'hour') number = parseInt(number) * 60;
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
                              self.onSpeech(result);
                          });
                        }
                      }
                    }
                };

                if ( trigger.id == 'rain' ) {
                    options['rain'] = true;
                } else if ( trigger.id == 'no' || trigger.id == 'dry') {
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
                } else if (s.indexOf (__("going")) > -1 || s.indexOf(__("soon")) > -1 || s.indexOf(__("will")) > -1 || s.indexOf(__("expect")) > -1 || s.indexOf(__("predict")) > -1) {
                    if (options['when'] == null) options['when'] = 120; //When future en when is empty --> 120 min
                } else if (options['when'] == null) {
                    options['when'] = 0; //Default is 0 min
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

                if (language == "en") {
                    //Englisch gramar stuff
                } else if (language == "nl") {
                    //Doe Nederlandse gramatica dingen
                }
                
            });

            Homey.log ("spoken_speech: " + speech.transcript);
            if (cache == null) {
                setTimeout( function() {module.exports.speakWeather( options );}, 5000) //If no weather update yet, what 5 sec
                Homey.log("Please wait, Homey is getting the buienradar info")
            } else {
                module.exports.speakWeather( options ); //ask_rain, ask_when
            }
        };
}

//get location
module.exports.getLocation = function( locationCallback ) {
    Homey.log("Get geolocation");

    Homey.manager('geolocation').on('location', function (location) {
        Homey.log( location );
        lat = location.latitude;
        lon = location.longitude;
        locationCallback(lat, lon);
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

        cache = {};
        rainInfo = {};

        if (lat == undefined) { //if no location, try to get it
            self.getLocation( function( lat, lon ) {  //Get the location, could be that location is not available yet after reboot
            })
        }

          var request = require('request');
          request('http://gps.buienradar.nl/getrr.php?lat=' + lat + '&lon=' + lon, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            //var array = "000|14:05 000|14:10 000|14:15 000|14:20 000|14:25 025|14:30 052|14:35 040|14:40 050|14:45 060|14:50 070|14:55 080|15:00 000|15:05 000|15:10 000|15:15 000|15:20 000|15:25 000|15:30 000|15:35 000|15:40 000|15:45 000|15:50 000|15:55 000|16:00 000|16:05";
            //var array = array.split(' '); //Enable this line again when using testing string instead of the real weather
            var array = body.split('\r\n'); //split into seperate items

            Homey.log ("Array: " + array); //location

            var rain_found;
            var rainTotal = 0;
            var rainAverage = 0;
            var rainEntrys = 0;
            var firstEntry;
            var firstDifMinute;
            var stop;
            var start;

            for (var i = 2; i < 24; i++) { //get the coming 120 min (ignore first 2 items)
                var array2 = array[i].split('|'); //split rain and time
                var rainMm = parseInt(array2[0]); //Take mm and make it a int
                var rainTime = array2[1];
                var rainMinute = parseInt(rainTime.substr(rainTime.indexOf(":") + 1));
                var rainHours = parseInt(rainTime.substr(rainTime.indexOf(":") - 2, 2));
                var d = new Date();
                var hours = d.getHours();
                var currentMinute = d.getMinutes();

                //hours = parseInt(hours) + 2; //Disable when not using virtual Homey

                if (hours == rainHours) {
                    difMinute = rainMinute - currentMinute;
                }
                else if (hours + 1 == rainHours) {
                    difMinute = 60 - currentMinute + rainMinute;
                } else if (hours + 2 == rainHours) {
                    difMinute = 120 - currentMinute + rainMinute;
                }

                if (difMinute < 0) difMinute = 0; //Make a 'int' that is just below 0 a 0

                if (firstEntry !== false) { //Only on the first entry
                    firstDifMinute = difMinute;

                    var rainMm = parseInt(array2[0]);

                    Homey.log ('start', start);
                    Homey.log ('stop', stop);
                    Homey.log ('difMinute', difMinute);
                    Homey.log ('rainMm', rainMm);
                    if (rainMm > 0 && start != true){
                        Homey.log("Trigger rain and raining_in start");
                        Homey.manager('flow').trigger('rain_start');
                        //Homey.manager('flow').trigger('raining_in'); //Check for triggers with time involved
                        start = true;
                        stop = false;
                    } else if (rainMm == 0 && stop != true){
                        Homey.log("Trigger rain stop");
                        Homey.manager('flow').trigger('rain_stop');
                        start = false;
                        stop = true;
                    } else {
                        Homey.log("No triggers triggered")
                    }

                    firstEntry = false;
                }

                rainTotal = rainTotal + rainMm;
                rainEntrys = rainEntrys + 1;

                var rainMm = parseInt(array2[0]); //Take mm and make it a int
                var rainTime = array2[1];

                rainInfo[ difMinute ] = { //Extend the existing rainInfo object with the new content
                    mm: rainMm
                };

                cache = rainInfo;
            }

        Homey.manager('flow').trigger('raining_in'); //Check for triggers with time involved
        Homey.log(cache);

          }
      }.bind(this));
};

module.exports.speakWeather = function( options ){
    Homey.log("speakWeather");

    var rainInfo = cache;
    var rainTotal = 0;
    var rainAverage = 0;
    var rainEntrys = 0;
    var start;
    var stop;
    var found = false;
    var output;
    var rainIntensity = "";
    var maxIntensity = 0;
    var foundIntensity = false;
    var yesNo;
    var lastObj;
    specificRainInfo = {}; //clear

    Homey.log(arguments); //Log what is asked

    //Get a specific part of the rain info
    for (var time in rainInfo) {
        var mm = (rainInfo[time].mm); //Rain
        if (options.when == null) { //If no time specified, get everything
            specificRainInfo[ time ] = { //fill the specificRainInfo object
                mm: mm
            };
            rainTotal = rainTotal + mm;
            if (mm > 0) rainEntrys = rainEntrys + 1;
            if (mm > maxIntensity) maxIntensity = mm;
            //Homey.log("not time");
        } else if (options.when < 0) {
            if (time < 5) {
                specificRainInfo[ time ] = {
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                if (mm > maxIntensity) maxIntensity = mm;
                Homey.log("at");
            }
        } else if (options.whenRelative == 'at' || options.when == 0) {
            if (time == options.when) {
                specificRainInfo[ time ] = {
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                if (mm > maxIntensity) maxIntensity = mm;
                Homey.log("at");
            }
        } else if (options.whenRelative == 'before' || options.whenRelative == null) { //If before or not defined
            if (time <= options.when) {
                specificRainInfo[ time ] = {
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                if (mm > maxIntensity) maxIntensity = mm;
                Homey.log("before");
            }
        } else if (options.whenRelative == 'after') {
            if (time >= options.when) {
                specificRainInfo[ time ] = { 
                    mm: mm
                };
                rainTotal = rainTotal + mm;
                if (mm > 0) rainEntrys = rainEntrys + 1;
                if (mm > maxIntensity) maxIntensity = mm;
                Homey.log("after");
            }
        }
    }

    //Calculate average rain amount
    if (rainEntrys != 0) {
        rainAverage = rainTotal / rainEntrys;
    }

    Homey.log("rainAverage", rainAverage); //Log the amount of rain
    Homey.log(specificRainInfo); //Show the array of raiEntrys

    // Check intensity
    for (var time in specificRainInfo) {
        var mm = (specificRainInfo[time].mm); //Rain
        lastObj = false;

        if (mm > 0) { //It contains rain
            if (options.intensity == null) { //No certain intensity
                if (found == false) { start = time; found = true };
                stop = time;
                lastObj = true;
                Homey.log("It will rain without intensity!")
            } else if (options.intensity < mm) { //Certain intensity
                if (found == false) { start = time; found = true };
                stop = time;
                lastObj = true;
                foundIntensity = true;
                Homey.log("It will rain that hard!")
            }
        }
        if (mm == 0) { //No rain
            Homey.log("It wil stay dry");
        }
    }

    if (lastObj == true ) stop = null; //If last entry is rain, the rain is not going to stop

    //Determine words for intensity to speakout
    if (maxIntensity < 85) rainIntensity = __("light");
    if (maxIntensity> 85 && rainAverage < 255) rainIntensity = __("moderate");
    if (maxIntensity > 255) rainIntensity = __("heavy");
    if (maxIntensity == 0) rainIntensity = __("no");

    //Normal yes and no
    if (rainAverage == 0) yesNo = __("no");
    if (rainAverage > 0) yesNo = __("yes");
    if (rainAverage == 0 && options.rain == false) yesNo = __("yes");
    if (rainAverage > 0 && options.rain == false) yesNo = __("no");

    //When asked for a certain intensity
    if (foundIntensity == true && options.intensity != null) yesNo = __("yes");
    if (foundIntensity == false && options.intensity != null) yesNo = __("no");

    if (stop == null && options.speech.indexOf("stop") > -1) yesNo = __("no"); //Rain will not stop

    //When the senteces contains a "not" turn the YesNo around
    //if (options.speech.indexOf("not") > -1) {if (yesNo == __("yes")){yesNo = __("no")} else if (yesNo == __("no")){yesNo = __("yes")} };

    if (options.when == 120) options.when = '2 ' + __("hours"); 
    if (options.when == 60) options.when = '1 ' + __("hour"); 
    if (options.when == 1) options.when = options.when + " " + __("minute"); 
    if (options.when == 0) options.when = __("now");
    if (options.when < 120) options.when = options.when + " " + __("minutes");

    //Custom words and options for certain questions
    if (start != null && options.when != __("now")) options.when = start + " " + __("minutes"); //no certain time and start exists
    if (stop == null && options.speech.indexOf("stop") > -1) options.when = '2 ' + __("hours"); //
    if (options.speech.indexOf("start" && start != null) > -1) options.when = start + " " + __("minutes"); //"start" and start exists
    if (options.speech.indexOf("stop" && stop != null) > -1) options.when = stop + " " + __("minutes"); //"stop" and stop exists
    if (options.speech.indexOf("when") > -1 || options.speech.indexOf("how") > -1) yesNo = ""; //Don't say Yes or No when user asks for when or how

    if (options.whenRelative == null && options.speech.indexOf("start") > -1 || options.speech.indexOf("stop") > -1) options.whenRelative = __("at"); //But if it is start or stop make it at
    if (options.whenRelative == null) options.whenRelative = __("in"); //By default it is in
    if (options.whenRelative == "before") options.whenRelative = __("before"); 
    if (options.whenRelative == "after") options.whenRelative = __("after"); 
    if (options.whenRelative == "at") options.whenRelative = __("in"); //ToDo fix "at" in "in" issue

    //Speak one of the sentences
    if (options.speech.indexOf("start") > -1 && start != null) {
        output = __("start_rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    } else if (options.speech.indexOf("stop") > -1 && stop != null) {
        output = __("stop_rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    } else if (options.speech.indexOf("start") > -1 && start == null) {
        output = __("not_start_rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    } else if (options.speech.indexOf("stop") > -1 && stop == null && rainAverage > 0) {
        output = __("not_stop_rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    } else if (options.when == __("now")) {
        output = __("rain_now", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.when": options.when } )
    } else if (rainAverage >= 1) {
        output = __("rain", { "yesNo": yesNo, "rainIntensity": rainIntensity, "options.whenRelative": options.whenRelative, "options.when": options.when } )
    } else if (rainAverage == 0) {
        output = __("no_rain", { "yesNo": yesNo, "options.whenRelative": options.whenRelative, "options.when": options.when } );
    }

    Homey.log("Homey say: " + output);
    Homey.manager('speech-output').say( output );
};