"use strict";

function App() 
{
    this.cache = {};
    this.woeid = undefined;
}

module.exports = App;

var difMinute;

App.prototype.init = function(){
    Homey.log("App started");

    Homey.manager('speech-input').on('speech', function(speech) {
        Homey.log("Speech is triggered");

        var spoken_text;
        var format;

            // loop all triggers
            speech.triggers.forEach(function(trigger){

                Homey.log ("speech.transcript: " + speech.transcript);
                
            });

        Homey.log ("spoken_text: " + spoken_text);
        app.updateWeather (spoken_text);
        app.events.speech.call(app, speech, difMinute); //call speech function
    })

    var location;
    var lat, lon;

    setInterval(trigger_update.bind(this), 1000 * 10 *5); //1000 * 60 * 5

    function trigger_update() {
      this.updateWeather( function(difMinute){});
    };

    app.getLocation( function( lat, lon ) {
      Homey.log (lat);
    })
}

//get location
App.prototype.getLocation = function( locationCallback ) {
    Homey.log("Get geolocation");
    Homey.manager('geolocation').getLocation(function(location) {
        Homey.log( location );
        var lat, lon;
        lat = location.latitude;
        lon = location.longitude;

        locationCallback(lat, lon);
    });
};

// update the weather
App.prototype.updateWeather = function( callback ) {
    Homey.log("Update Weather");

    this.getLocation( function( lat, lon ){
        var request = require('request');
        request('http://gps.buienradar.nl/getrr.php?lat=' + lat + '&lon=' + lon, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            var array = body.split('\r\n'); //split into seperate items

            var rain_found;
            var found;

            for (var i = 1; i < 7; i++) { //get the coming 30 min (ignore first 2 items)
                var array2 = array[i].split('|'); //split rain and time
                if (array2[0] > 0 && rain_found != 1){ //if rain is more then 0 and not already found
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

                    difMinute = 5; //dummy variable
                    rain_found = true;

                    Homey.log(difMinute);

                    //callback(difMinute);
                } else if (found != 1) {
                    Homey.log("No Rain found");
                    rain_found = false;
                    //difMinute = 5; //dummy variable
                    difMinute = 0;
                    //callback(difMinute);
                    found = 1;
                };
            }
          }
      }.bind(this));
    })
};

App.prototype.events = {};
App.prototype.events.speech = function( speech, difMinute ) {
    Homey.log("events.speech");  

    var ask_rain;
    var ask_when;

    speech.triggers.forEach(function(trigger){

        if( trigger.id == 'rain' ) {
            ask_rain = true;
        } else if ( trigger.id == '5min' ) {
            ask_when = '5';
        }
        else if( trigger.id == 'x_minutes' ) { //Not working yet
          // try to find a number
          var numbers = speech.transcript.match(/\d+/);
                
          if( Array.isArray( numbers ) ) {
            var number = numbers[0];
              number = parseInt(number);
            
            if( !isNaN( number ) ) {
              if( number > 0 && number <= 15 ) {
                ask_when = number;
              }
            }
          }
        };
        
    });

    Homey.log(ask_rain);
    Homey.log(difMinute);

    this.speakWeather( ask_rain, difMinute, ask_when );
}

App.prototype.speakWeather = function( ask_rain, difMinute, ask_when ){
    Homey.log("speakWeather");
    Homey.log(difMinute);

    var when;

    /*var weather = this.getCache( ask_rain );
        weather = weather.weather;
        
    if( !weather ) {
        Homey.say( __("I couldn't get the weather. Take a look outside!") );
        return false;
    }*/

    if (ask_rain == true){ //Just asking for rain no specified time

    if( difMinute == '999' ) when = __('no rain expected within the next 30 minutes');
    if( difMinute <= '5' ) when = __('rain expected within 5 minutes');
    if( difMinute <= '10' ) when = __('rain expected within 10 minutes');
    if( difMinute <= '15' ) when = __('rain expected within 15 minutes');
    if( difMinute <= '30' ) when = __('rain expected within 30 minutes');

    };

    if (ask_rain == true && ask_when != "undefined" && difMinute != 999 ){ //Ask rain with specified time

      Homey.log ('ask_rain:' + ask_rain);
      Homey.log ('ask_when:' + ask_when);
      Homey.log ('difMinute:' + difMinute)

      if (parseInt(difMinute) <= parseInt(ask_when)) {
        when = ('Telling: rain expected within the next ' + ask_when + ' minutes');
      }

    };

    /*Homey.say( __(
        when
    ) );*/

    Homey.log(when);
};

var app = new App();
app.init(); //call init function
//app.events.speech.call(app, speech); //call speech function
//app.speakWeather(); //call speak Weather