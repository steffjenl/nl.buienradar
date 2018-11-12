# Buienradar

Gets the forecast based on your GPS Coordinates (lat/lon);

## Installation
```
$ npm install buienradar
```

## Example

```javascript
const Buienradar = require('..');

// create a Buienradar instance
const b = new Buienradar({
	lat: 52.22377,
	lon: 6.87236,
});

// get the forecast
b.getNextForecast().then(forecast => {
	console.log('The next forecast is:', forecast);
}).catch(console.error);
```

See `./examples/` for more examples.