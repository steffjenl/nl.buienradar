# Node-Buienradar api wrapper

This is a api wrapper for the (limited) api of www.buienradar.nl

The api uses your location to get 
* 2 hour rainfall prediction
* (nearest) weatherstation sensor values
* 5 day weather forecast
* todays weather in text

## Example usage:  
```javascript
var Buienradar = require('./index.js');

var radar = new Buienradar({ lat: 52.2203748, lon: 6.8666693 });

radar.getRainData().then(result => {
  /* Result is a data object of type
   *[{
   *  value       // the raw rain value from the buienradar api
   *  amount      // the amount of rain in mm/h
   *  time        // the timestamp of the prediction
   *  indication  // an indication value that can be checked with Buienradar.rainIndicators
   * },
   * ...
   * ]
   */
  console.log(result);

  if (result[0].indication === Buienradar.rainIndacators.NO_RAIN) {
    console.log('Yeah!');
  }
});

radar.getNearestWeatherStationData(['regenMMPU']).then(result => {
  /* Result is a data object of type
   * {
   *  stationcode,      // id of the weather station
   *  stationnaam: {
   *    _ ,             // weather station name
   *    '$'             // weather station region name
   *  },
   *  lat,              // latitude
   *  lon,              // longitude
   *  datum,            // date
   *  luchtvochtigheid, // humidity
   *  temperatuurGC,    // temperature in degrees centigrade
   *  windsnelheidMS,   // wind speed in meter/second
   *  windsnelheidBF,   // wind speed in Beaufort scale
   *  windrichtingGR,   // wind direction in degrees
   *  windrichting,     // string representation of wind direction
   *  luchtdruk         // air pressure
   *  zichtmeter,       // visibility distance
   *  windstotenMS,     // max winds in meter/second
   *  regenMMPU,        // rain in mm/hour
   * }
   */
  console.log(result);
});

radar.getWeatherForecast().then(result => {
  /* Result is a data object of type
   * {
   *  tekst_middellang,
   *  tekst_lang,
   *  dagen: [
   *    {
   *       datum: 'vrijdag 13 mei 2016',
   *       dagweek: 'vr',
   *       kanszon: '60',
   *       kansregen: '10',
   *       minmmregen: '0',
   *       maxmmregen: '0',
   *       mintemp: '14',
   *       mintempmax: '14',
   *       maxtemp: '21',
   *       maxtempmax: '21',
   *       windrichting: 'N',
   *       windkracht: '4',
   *       sneeuwcms: '0' },
   *    }, ...
   *  ]
   * }
   */
  console.log(result);
});

radar.getCurrentWeather().then(result => {
  console.log(result);
});

radar.getFeedData().then(result => {
  console.log(result);
});
```