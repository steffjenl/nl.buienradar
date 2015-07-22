"use strict";

function App() 
{
    this.cache = {};
}

module.exports = App;
var app = new App();

var difMinute;
var lat;
var lon;

App.prototype.init = function(){
    Homey.log("Buienradar app started");

    app.cache = {}; //Creat app.cache
    
    //Get location
    app.getLocation( function( lat, lon ) {} )  //Get the location

    //Update weather after 5 seconds and every 5 minutes
    setTimeout(function () {
        app.updateWeather( function(difMinute){});
    }, 5000)
    setInterval(trigger_update.bind(this), 1000 * 10 *5); //1000 * 60 * 5
    function trigger_update() {
      this.updateWeather( function(difMinute){});
    };

    //Listen for speech triggers
    Homey.manager('speech-input').on('speech', onSpeech)

    //TO DO:
    /*Test for to trigger the rain flow
    setInterval(trigger_rain.bind(this), 1000 * 5);
    function trigger_rain() {
      Homey.manager('flow').trigger('rain_start');
      Homey.log ("Rain start");
    };*/
}

//Listen for speech
function onSpeech(speech) {
        Homey.log("Speech is triggered");

        var spoken_text;
        var format;
        var ask_rain;
        var ask_when;

        speech.triggers.forEach(function(trigger){ //Listen for triggers

            if( trigger.id == 'rain' ) {
                ask_rain = true;
            } else if ( trigger.id == 'now' ) {
                ask_when = '0';
            } else if ( trigger.id == 'quarter' ) {
                ask_when = '15';
            } else if ( trigger.id == 'half_hour' ) {
                ask_when = '30';
            } else if ( trigger.id == 'hour' ) {
                ask_when = '60';
            }

            for (var i = 0; i<= 30; i++) {
                if ( trigger.id == i) {
                    ask_when = i;
                }
            }

            if( trigger.id == 'rain' ) { // try to find a number
              Homey.log("Try to find numbers");
              var numbers = speech.transcript.match(/\d+/);
                    
              if( Array.isArray( numbers ) ) {
                var number = numbers[0];
                  number = parseInt(number);
                
                if( !isNaN( number ) ) {
                  if( number > 0 && number <= 30 ) {
                    ask_when = number;
                  }
                }
              }
            }
            
        });

        Homey.log ("spoken_text: " + speech.transcript);
        app.speakWeather( ask_rain, difMinute, ask_when ); //ask_rain, difMinute, ask_when
}

//get location
App.prototype.getLocation = function( locationCallback ) {
    Homey.log("Get geolocation");

    Homey.manager('geolocation').getLocation(function(location) {
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
App.prototype.updateWeather = function( callback ) {
    Homey.log("Update Weather");

        if (lat == undefined) { //if no location, try to get it
            app.getLocation( function( lat, lon ) {  //Get the location, could be that location is not available yet after reboot
            })
        }

        var request = require('request');
          request('http://gps.buienradar.nl/getrr.php?lat=' + lat + '&lon=' + lon, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            //var array = "000|14:10 000|14:15 001|14:20 002|14:25 003|14:30 004|14:35 005|14:40 006|14:45 007|14:50 008|14:55 009|15:00 010|15:05 000|15:10 000|15:15 000|15:20 000|15:25 000|15:30 000|15:35 000|15:40 000|15:45 000|15:50 000|15:55 000|16:00 000|16:05 000|16:10 ";
            //var array = array.split(' '); //Enable this line again when using testing string isntead of the real weahter
            var array = body.split('\r\n'); //split into seperate items

            Homey.log ("Array: " + array);
            Homey.log ("Lat: " + lat);
            Homey.log ("Lon: " + lon);

            var rain_found;
            var rainTotal = 0;
            var rainAverage = 0;
            var rainEntrys = 0;

            for (var i = 1; i < 13; i++) { //get the coming 60 min (ignore first 2 items) (12 x 5 = 60)
                var array2 = array[i].split('|'); //split rain and time
                if (array2[0] > 0){ //if rain is more then 0 and not already found
                    var rainMm = parseInt(array2[0]); //Take mm and make it a int
                    var rainTime = array2[1];
                    var rainMinute = parseInt(rainTime.substr(rainTime.indexOf(":") + 1));
                    var rainHours = parseInt(rainTime.substr(rainTime.indexOf(":") - 2, 2));
                    var d = new Date();
                    var hours = d.getHours();
                    var currentMinute = d.getMinutes();

                    if (hours == rainHours) {
                        difMinute = rainMinute - currentMinute;
                    }
                    else {
                        difMinute = 60 - currentMinute + rainMinute;
                    }

                    rainTotal = rainTotal + rainMm;
                    rainEntrys = rainEntrys + 1;
                    rain_found = true;
                }
            }

            if (rain_found == true){
                Homey.log ("Rain found and cache set");

                rainAverage = rainTotal / rainEntrys;
                app.cache = {difMinute: difMinute, mm: rainAverage}; //Write difMinute and rainAverage into cache

                Homey.manager('flow').trigger('rain_start'); //Tell the trigger that is starts raining

            } else if (rain_found == false) {
                Homey.log("No Rain found");
                    
                difMinute = 0;
                app.cache = {difMinute: difMinute, mm: 0}; //Write difMinute into cache
            };
          }
      }.bind(this));
};

App.prototype.speakWeather = function( ask_rain, difMinute, ask_when ){
    Homey.log("speakWeather");

    var when;
    var ask_when;
    var difMinute = this.cache.difMinute;
    var mm = this.cache.mm;
    var rainIntensity;

    if (ask_rain == true && ask_when == "undefined"){ //Just asking for rain no specified time
        if( difMinute == '999' ) difMinute = __('no rain expected within the next 30 minutes');
        if( difMinute <= '5' ) difMinute = __('rain expected within 5 minutes');
        if( difMinute <= '10' ) difMinute = __('rain expected within 10 minutes');
        if( difMinute <= '15' ) difMinute = __('rain expected within 15 minutes');
        if( difMinute <= '30' ) difMinute = __('rain expected within 30 minutes');
    };

    if (ask_rain == true && ask_when != "undefined" && difMinute != 999 && ask_when != "undefined"){ //Ask rain at specified time
      Homey.log ('ask_rain: ' + ask_rain);
      Homey.log ('ask_when: ' + ask_when);
      Homey.log ('difMinute: ' + difMinute);
      Homey.log ('mm: ' + mm);

      /*
      Licht: 0.2 mm/u
      Gematigd: 1 mm/u
      Zwaar: 3 mm/u
    */

      if (mm <= 0.2) rainIntensity = __('light');
      if (mm <= 1 && mm > 0.2) rainIntensity = __('moderate');
      if (mm >= 3) rainIntensity = __('heavy');

      if (parseInt(difMinute) <= parseInt(ask_when) && parseInt(difMinute) != 0) { //If difMinut is smaller as ask_when and they are not the same
        when = rainIntensity + " rain expected within the next " + ask_when + " minutes";
      } else {
        when = "No rain expeced within the next " + ask_when + " minutes";
      }
    }

    Homey.log("Homey say: " + when);
    Homey.manager('speech-output').say( __(when) );
};