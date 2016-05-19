'use strict';

const Buienradar = require('buienradar');

module.exports.init = function () {
  Homey.manager('speech-input').on('speech', onSpeech)
};

function onSpeech(speech) {
  const dataRequest = Homey.app.api.getRainData();
  const triggers = {};
  const options = {
    responseType: 'simple',
    inTime: null,
    raining: true,
    cantNegate: false,
    fromTime: new Date(),
    toTime: null,
    minRain: null,
    maxRain: null,
    checkInterval: null
  };
  const result = {
    startPrefix: '',
    start: '',
    rainPrefix: '',
    rainAmount: '',
    rainType: '',
    rain: '',
    rainSuffix: '',
    timePrefix: '',
    time: '',
    timeSuffix: '',
    endPrefix: '',
    end: ''
  };

  console.log(require('util').inspect(speech, { depth: 9 }));

  if (speech.time) {
    speech.time = speech.time.sort((a, b) => a.index - b.index);
    speech.time.forEach(time => {
      time.date = new Date(time.time.year, time.time.month, time.time.day, time.time.hour, time.time.minute || 0, time.time.second || 0);
    });
  }
  speech.triggers = speech.triggers.sort((a, b) => a.position - b.position);
  speech.triggers.forEach(trigger => triggers[trigger.id] = trigger);
  speech.triggers.forEach(trigger => {
    switch (trigger.id) {
      case 'dry':
        options.raining = !options.raining;
        options.rainPrefix = 'be';
        options.rain = trigger.text;
        break;
      case 'rain':
        result.rain = 'rain';
        break;
      case 'negate':
        options.raining = options.cantNegate || !options.raining;
        break;
      case 'longer':
      case 'for':
        options.responseType = 'interval';
        const forTime = getTimeAfterIndex(speech, trigger.position);
        console.log('for', forTime, isNaN(forTime.date));
        if (forTime && !isNaN(forTime.date)) {
          if (trigger.id === 'longer') {
            forTime.date = new Date(forTime.date + 60000);
          }
          options.checkInterval = forTime.date - Date.now();
          if (!triggers.when) {
            options.toTime = options.toTime || forTime.date;
          }
          result.time = '';
        }
        break;
      case 'in':
        const inTime = getTimeAfterIndex(speech, trigger.position);
        console.log('in', inTime, isNaN(inTime.date));
        if (inTime && !isNaN(inTime.date)) {
          const slack = 3 * 60 * 1000;
          options.fromTime = new Date(inTime.date.getTime() - slack);
          options.toTime = new Date(inTime.date.getTime() + (!isNaN(options.checkInterval) ? options.checkInterval : slack));
          result.time = `in ${getTimeDeltaString(inTime.date)}`;
          options.inTime = inTime.date;
        }
        break;
      case 'from_now':
        const fromNowTime = getTimeAfterIndex(speech, trigger.position, true);
        if (fromNowTime && !isNaN(fromNowTime.date)) {
          const slack = 3 * 60 * 1000;
          options.fromTime = new Date(fromNowTime.date.getTime() - slack);
          options.toTime = new Date(fromNowTime.date.getTime() + (!isNaN(options.checkInterval) ? options.checkInterval : slack));
          result.time = `in ${getTimeDeltaString(fromNowTime.date)}`;
          options.inTime = fromNowTime.date;
        }
        break;
      case 'coming':
        options.fromTime = new Date();
        options.toTime = getTimeAfterIndex(speech, trigger.position).date;
        result.time = '';
        options.inTime = null;
        break;
      case 'soon':
        options.fromTime = new Date();
        options.toTime = new Date(Date.now() + 30 * 60 * 1000);
        break;
      case 'umbrella':
        options.responseType = 'umbrella';
        options.umbrella = trigger.text;
        options.raining = true;
        options.cantNegate = true;
        result.rain = 'rain';
        break;
      case 'light':
      case 'moderate':
      case 'heavy':
      case 'violent':
        options.checkInterval = 0;
        options.minRain = getRainIndicationFromTrigger(trigger);
        options.rainType = options.minRain;
        result.rainType = getRainIndicationString(options.minRain);
        break;
    }
  });
  if (!options.raining) {
    options.maxRain = options.maxRain || (options.minRain ? changeIndicatorBySteps(options.minRain, -1) : false) || Buienradar.rainIndicators.NO_RAIN;
    options.minRain = Buienradar.rainIndicators.NO_RAIN;
  }
  if(options.responseType === 'umbrella' && options.inTime){
    options.fromTime = options.inTime;
    options.toTime = null;
  }
  if(triggers.when && triggers.in){
    result.time = '';
    options.toTime = null;
  }
  options.minRain = options.minRain || Buienradar.rainIndicators.LIGHT_RAIN;

  console.log(options);
  console.log(result);

  dataRequest.then(rainData => {
    const rainTime = getRainTime(rainData, options.minRain, options.maxRain, options.fromTime, options.toTime, options.checkInterval);
    const resultIsCurrently = rainTime.first &&
      rainTime.first.time - 10 * 60 * 1000 <= Date.now() &&
      (!options.minRain || rainTime.current.indication >= options.minRain) &&
      (!options.maxRain || rainTime.current.indication <= options.maxRain);

    if (options.responseType === 'simple') {
      if (!options.raining) {
        if (rainTime.first) {
          if (!triggers.when) {
            if (rainTime.first.time - options.fromTime <= 10 * 60 * 1000) {
              result.startPrefix = 'yes,';
            } else {
              result.startPrefix = 'no, but';
            }
          }
          if (result.rainType) {
            result.start = 'there is no';
            result.rainSuffix = 'expected';
            if (!resultIsCurrently) {
              result.time = result.time || `in ${getTimeDeltaString(rainTime.first.time)}`;
            }
          } else {
            result.rain = 'dry';
            if (resultIsCurrently) {
              result.start = 'it is currently'
            } else {
              result.start = 'it is expected to';
              result.rainPrefix = 'be';
              result.time = result.time || `in ${getTimeDeltaString(rainTime.first.time)}`;
            }
            result.endPrefix = 'for';
            if (!rainTime.last) {
              result.endPrefix += ' at least';
            }
            result.end = getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
          }
        } else {
          const invertedRainTime = getRainTime(rainData, changeIndicatorBySteps(options.maxRain, 1), null, options.fromTime, options.toTime, options.checkInterval);
          if (!triggers.when) {
            result.startPrefix = 'no,'
          }
          if (options.fromTime <= Date.now()) {
            result.start = 'there currently is';
            result.timePrefix = '';
            result.time = '';
            if (rainTime.last) {
              result.endPrefix = 'and it is expected to last for';
            }
          } else {
            result.start = 'there is';
            result.rainSuffix = 'expected';
          }
          result.rainPrefix = '';
          result.rainType = getRainTypeString(invertedRainTime);
          result.endPrefix = result.endPrefix || 'which will last for';
          if (!invertedRainTime.last) {
            result.endPrefix += ' at least';
          }
          result.end = getTimeDeltaString(invertedRainTime.last ? invertedRainTime.last.time : rainData[rainData.length - 1].time, invertedRainTime.first.time);
        }
      } else {
        if (rainTime.first) {
          if (rainTime.current.indication >= options.minRain && resultIsCurrently) {
            if (!triggers.when) {
              result.startPrefix = 'yes,';
            }
            rainTime.first = rainTime.current;
            result.start = 'there currently is';
            result.rainType = getRainTypeString(rainTime);
            result.timePrefix = '';
            result.time = '';
            if (rainTime.last) {
              result.endPrefix = 'and it is expected to last for';
            }
          } else {
            if (!triggers.when) {
              if (rainTime.first.time - options.fromTime <= 10 * 60 * 1000) {
                result.startPrefix = 'yes,';
              } else {
                result.startPrefix = 'no, but';
              }
            }
            result.start = 'there is';
            result.rainType = getRainTypeString(rainTime);
            result.rainSuffix = 'expected';
            if (!result.time) {
              result.timePrefix = result.timePrefix || 'in';
              result.time = getTimeDeltaString(rainTime.first.time);
            }
          }
          result.endPrefix = result.endPrefix || 'which will last for ';
          if (!rainTime.last) {
            result.endPrefix += 'at least';
          }
          result.end = getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
        } else {
          const invertedRainTime = getRainTime(rainData, Buienradar.rainIndicators.NO_RAIN, changeIndicatorBySteps(options.minRain, -1), options.fromTime, options.toTime, options.checkInterval);
          if (!triggers.when) {
            result.startPrefix = 'no,';
          }
          if (options.minRain === Buienradar.rainIndicators.NO_RAIN) {
            result.start = 'it is expected to';
            result.rainPrefix = 'be';
            result.rain = 'dry';
          } else {
            result.start = 'there is no';
            result.rainSuffix = 'expected';
          }
          result.endPrefix = 'for';
          if (!invertedRainTime.last) {
            result.endPrefix += ' at least';
          }
          result.end = getTimeDeltaString(invertedRainTime.last ? invertedRainTime.last.time : rainData[rainData.length - 1].time, invertedRainTime.first.time);
        }
      }
    } else if (options.responseType === 'interval') {
      if (!options.raining) {
        if (rainTime.first) {
          if (!triggers.when) {
            result.startPrefix = 'yes,';
          }
          if (!resultIsCurrently) {
            result.start = 'it is expected to';
            result.rainPrefix = 'be';
          } else {
            result.start = 'it currently is';
          }
          result.time = result.time || `in ${getTimeDeltaString(rainTime.first.time)}`;
          result.rain = 'dry';
          result.endPrefix = 'for';
          if (!rainTime.last) {
            result.endPrefix += 'at least';
          }
          result.end = getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
        } else {
          if (!triggers.when) {
            result.startPrefix = 'no,';
          }
          result.start = 'it will not be';
          result.rain = 'dry';
          result.rainSuffix = `for ${triggers.longer ? '' : 'a period of'} ${getTimeDeltaString(new Date(Date.now() + options.checkInterval))}${triggers.longer ? ' or longer' : ''}`;
          if (triggers.when) {
            result.end = 'in the next 2 hours';
          }
        }
      } else {
        if (rainTime.first) {
          if (!triggers.when) {
            result.startPrefix = 'yes,';
          }
          result.start = `there ${resultIsCurrently ? 'currently' : ''} is`;
          result.rainType = getRainTypeString(rainTime);
          if (!resultIsCurrently) {
            result.timePrefix = 'expected';
            result.time = result.time || `in ${getTimeDeltaString(rainTime.first.time)}`;
          }
          result.endPrefix = 'which will last for';
          if (!rainTime.last) {
            result.endPrefix += 'at least';
          }
          result.end = getTimeDeltaString(rainTime.last ? rainTime.last.time : rainData[rainData.length - 1].time, rainTime.first.time);
        } else {
          if (!triggers.when) {
            result.startPrefix = 'no,';
          }
          result.start = 'there will be no';
          result.rainSuffix = `for ${triggers.longer ? 'longer than' : 'a period of'} ${getTimeDeltaString(new Date(Date.now() + options.checkInterval))}`;
          if (triggers.when) {
            result.end = 'in the next 2 hours';
          }
        }
      }
    } else if (options.responseType === 'umbrella') {
      const rainList = [rainTime];
      while (rainList[rainList.length - 1].last) {
        rainList.push(getRainTime(rainData, options.minRain, options.maxRain, rainList[rainList.length - 1].last.time + 1, null, options.checkInterval));
      }
      if (rainList.length === 1) {
        if (rainList[0].first) {
          const rain = rainList[0];
          const totalTime = (rain.last ? rain.last.time : rainData[rainData.length - 1].time) - rain.first.time;
          if (totalTime > 30 * 60 * 1000) {
            result.startPrefix = `yes, you should bring your ${options.umbrella}.`;
          } else if (totalTime > 10 * 60 * 1000 || rain.max.indication >= Buienradar.rainIndicators.HEAVY_RAIN) {
            result.startPrefix = `you will probably need your ${options.umbrella}.`;
          } else {
            result.startPrefix = `you can probably survive without your ${options.umbrella}.`
          }
          result.start = 'There is';
          result.rainType = getRainTypeString(rain);
          if(resultIsCurrently) {
            result.time = 'which is already started';
            result.endPrefix = 'and will last for';
          }else{
            result.rainSuffix = 'expected';
            result.time || `in ${getTimeDeltaString(rain.first.time)}`;
            result.endPrefix = 'which will last for';
          }
          if (!rain.last) {
            result.endPrefix += ' at least';
          }
          result.end = getTimeDeltaString((rain.last ? rain.last.time : rainData[rainData.length - 1].time), rain.first.time);
        } else {
          result.startPrefix = `no, you can leave your ${options.umbrella} at home.`;
          result.start = 'It is expected to be';
          result.rainType = '';
          result.rain = 'dry';
          result.endPrefix = 'for at least';
          result.end = getTimeDeltaString(rainData[rainData.length - 1].time, options.fromTime);
        }
      } else {
        const rain = rainList[0];
        let totalTime = 0;
        rainList.forEach(rainItem => {
          if (rainItem.first) {
            totalTime += (rainItem.last ? rainItem.last.time : rainData[rainData.length - 1].time) - rainItem.first.time;
          }
          if (rainItem.min && rain.min.indication > rainItem.min.indication) {
            rain.min = rainItem.min;
          } else if (rainItem.max && rain.max.indication < rainItem.max.indication) {
            rain.max = rainItem.max;
          }
        });

        if (totalTime > 30 * 60 * 1000) {
          result.startPrefix = `yes, you should bring your ${options.umbrella}.`;
        } else if (totalTime > 10 * 60 * 1000 || rain.max.indication >= Buienradar.rainIndicators.HEAVY_RAIN) {
          result.startPrefix = `you will probably need your ${options.umbrella}.`;
        } else {
          result.startPrefix = `you can probably survive without your ${options.umbrella}.`
        }

        result.start = `There are ${rainList.length} showers expected for ${getTimeDeltaString(rainData[rainData.length - 1].time, options.fromTime)}`;
        result.rain = '';
        if (resultIsCurrently) {
          result.timePrefix = 'that already started';
        } else {
          result.timePrefix = 'starting in';
          result.time = getTimeDeltaString(rain.first.time);
        }
        result.end = `which combined will last ${getTimeDeltaString(Date.now() + totalTime)}`;
      }
    }

    let response = '';
    Object.keys(result).forEach(key => {
      if (result[key]) {
        response += `${result[key]} `;
      }
    });
    response = response.charAt(0).toUpperCase() + response.slice(1);
    speech.say(response);
  }).catch(err => Homey.error(err, err.stack));
}

function changeIndicatorBySteps(indicator, posChange) {
  const indicators = Object.keys(Buienradar.rainIndicators);
  const index = Math.max(Math.min(indicators.findIndex(key => Buienradar.rainIndicators[key] === indicator) + posChange, indicators.length - 1), 0);
  return Buienradar.rainIndicators[indicators[index]];
}

function getTimeAfterIndex(speech, index, before) {
  if (speech.time) {
    if(before){
      return speech.time.sort((a, b) => b.index - a.index).find(time => time.index <= index || (time.index <= index && time.index + time.transcript.length >= index));
    }else {
      return speech.time.find(time => time.index >= index || (time.index <= index && time.index + time.transcript.length >= index));
    }
  } else {
    return null;
  }
}

function getTimeDeltaString(timeA, timeB) {
  timeB = timeB || Date.now();

  console.log('deltaTime', timeA, timeB, Math.abs(timeA - timeB));
  const delta = Math.round(Math.abs(timeA - timeB) / 60000);
  const hours = Math.floor(delta / 60);
  if (hours) {
    return `${hours} hour${hours === 1 ? '' : 's'} ${delta % 60 ? `and ${delta % 60} minute${delta % 60 === 1 ? '' : 's'}` : ''}`;
  } else {
    return `${delta} minute${delta === 1 ? '' : 's'}`;
  }
}

function getRainTypeString(rainTimeData) {
  if (!rainTimeData.rain) {
    return 'no';
  } else {
    return `${getRainIndicationString(rainTimeData.min.indication)}
    ${rainTimeData.min.indication !== rainTimeData.max.indication ? ` to ${getRainIndicationString(rainTimeData.max.indication)}` : ''}
    `
  }
}

function getRainIndicationString(indication) {
  switch (indication) {
    case Buienradar.rainIndicators.NO_RAIN:
      return 'no';
    case Buienradar.rainIndicators.LIGHT_RAIN:
      return 'light';
    case Buienradar.rainIndicators.MODERATE_RAIN:
      return 'moderate';
    case Buienradar.rainIndicators.HEAVY_RAIN:
      return 'heavy';
    case Buienradar.rainIndicators.VIOLENT_RAIN:
      return 'violent';
  }
}

function getRainIndicationFromTrigger(trigger) {
  if (trigger.id === 'light') {
    return Buienradar.rainIndicators.LIGHT_RAIN;
  } else if (trigger.id === 'moderate') {
    return Buienradar.rainIndicators.MODERATE_RAIN;
  } else if (trigger.id === 'heavy') {
    return Buienradar.rainIndicators.HEAVY_RAIN;
  } else if (trigger.id === 'violent') {
    return Buienradar.rainIndicators.VIOLENT_RAIN;
  } else {
    return null;
  }
}

function getRainTime(rainData, minRain, maxRain, fromTime, toTime, checkFor) {
  checkFor = checkFor || 5 * 60 * 1000;
  minRain = !isNaN(minRain) ? minRain : Buienradar.rainIndicators.LIGHT_RAIN;
  let checkedRain = false;
  const result = {};
  rainData.forEach(data => {
    if (data.time < Date.now()) {
      result.current = data;
    } else if ((!fromTime || data.time > fromTime) && (!toTime || data.time < toTime)) {
      checkedRain = true;
      if (!result.first && data.indication >= minRain && (!maxRain || data.indication <= maxRain)) {
        result.first = data;
        result.rain = data;
        result.min = data;
        result.max = data;
      } else if (result.first) {
        if (data.time - result.first.time <= checkFor) {
          if ((maxRain && data.indication > maxRain) || (minRain && data.indication < minRain)) { // 5 min no rain !== no rain
            console.log('clearing because', minRain, maxRain, data, result.first.time - data.time);
            result.first = null;
            result.rain = null;
            result.min = null;
            result.max = null;
            result.last = null;
          } else if (result.rain && data.indication > result.rain.indication && !maxRain || data.indication <= maxRain) {
            result.rain = data;
          }
        }
      }
    }
    if (result.first && !result.last) {
      if ((minRain && data.indication < minRain) || (maxRain && data.indication > maxRain)) {
        result.last = data;
      }
      if ((!result.min || ((!minRain || data.indication >= minRain) && result.min.indication > data.indication))) {
        result.min = data;
      }
      if (!result.max || ((!maxRain || data.indication <= maxRain) && result.max.indication < data.indication)) {
        result.max = data;
      }
    }
  });
  console.log(minRain, maxRain, fromTime, toTime, checkFor, result);
  return checkedRain ? result : false;
}