"use strict";

function App() 
{
    this.cache = {};
}

module.exports = App;
var app = new App();
app.cache = {}; //Creat app.cache

var difMinute;
var lat;
var lon;

App.prototype.init = function(){
    Homey.log("App started");

    //Get location of Homey
    app.getLocation( function( lat, lon ) {  //Get the location, could be that location is not available yet after reboot
    })

    //Update weather now and every 5 minutes
    this.updateWeather( function(difMinute){});
    setInterval(trigger_update.bind(this), 1000 * 10 *5); //1000 * 60 * 5
    function trigger_update() {
      this.updateWeather( function(difMinute){});
    };

    //Listen for speech triggers
    Homey.manager('speech-input').on('speech', function(speech) {
        Homey.log("Speech is triggered");

        var spoken_text;
        var format;
        var ask_rain;
        var ask_when;

        speech.triggers.forEach(function(trigger){ //For now it is here but should be in seperate function

            if( trigger.id == 'rain' ) {
                ask_rain = true;
            } else if ( trigger.id == 'now' ) {
                ask_when = '0';
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
        //app.updateWeather (spoken_text);
        //app.events.speech.call(); //call speech function
        //App.events.speech();
    })

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

                    //difMinute = 5; //dummy variable
                    rain_found = true;

                    App.cache = difMinute; //Write difMinute into cache

                    //callback(difMinute);
                } else if (found != 1) {
                    Homey.log("No Rain found");
                    rain_found = false;
                    //difMinute = 5; //dummy variable
                    difMinute = 0;
                    //callback(difMinute);
                    found = 1;

                    App.cache = difMinute; //Write difMinute into cache
                };
            }
          }
      }.bind(this));
};

//Listen for speech triggers
/*App.prototype.speech = function( speech ) {
    Homey.log("events.speech");

    var ask_rain;
    var ask_when;

    speech.triggers.forEach(function(trigger){

        if( trigger.id == 'rain' ) {
            ask_rain = true;
        } else if ( trigger.id == 'now' ) {
            ask_when = '0';
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
        }
        
    });

    Homey.log("ASK RAIN:" + ask_rain);
    Homey.log("ASK WHEN:" + ask_when);

    this.speakWeather( ask_rain, difMinute, ask_when );
}*/

App.prototype.speakWeather = function( ask_rain, difMinute, ask_when ){
    Homey.log("speakWeather");

    var when;
    Homey.log("App.cache: " + App.cache);
    difMinute = App.cache;

    /*if( !difMinute ) {
        Homey.log("There is now rain information available");
        return false;
    } else {

    Homey.log("Weather.. this works: " + difMinute);

    }*/

    var ask_when;

    if (ask_rain == true && ask_when == "undefined"){ //Just asking for rain no specified time

    if( difMinute == '999' ) difMinute = __('no rain expected within the next 30 minutes');
    if( difMinute <= '5' ) difMinute = __('rain expected within 5 minutes');
    if( difMinute <= '10' ) difMinute = __('rain expected within 10 minutes');
    if( difMinute <= '15' ) difMinute = __('rain expected within 15 minutes');
    if( difMinute <= '30' ) difMinute = __('rain expected within 30 minutes');

    };

    if (ask_rain == true && ask_when != "undefined" && difMinute != 999 ){ //Ask rain at specified time

      Homey.log ('ask_rain: ' + ask_rain);
      Homey.log ('ask_when: ' + ask_when);
      Homey.log ('difMinute: ' + difMinute)

      if (parseInt(difMinute) <= parseInt(ask_when) && parseInt(difMinute) != 0) { //If difMinut is smaller as ask_when and they are not the same
        when = "Rain expected within the next " + ask_when + " minutes";
      } else {
        when = "No rain expeced within the next " + ask_when + " minutes";
      }
    }
    Homey.log("Homey say: " + when);
    Homey.manager('speech-output').say( __(when) );
};

//app.init(); //call init function
//app.events.speech.call(app, speech); //call speech function
//app.speakWeather(); //call speak Weather