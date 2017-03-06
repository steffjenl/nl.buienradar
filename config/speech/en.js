'use strict';

module.exports = {
	element: {
		rain: {
			type: 'regex',
			value: 'rain(ing|fall)?|precipitation|showers?|drops?|drizzle',
		},
		dry: {
			type: 'regex',
			value: 'dry',
		},
		negate: {
			type: 'regex',
			value: 'no|not|stops?|ends?',
		},
		// timeframe elements
		for: {
			type: 'regex',
			value: 'for|at least',
		},
		following: {
			type: 'regex',
			value: 'following|coming|next|in',
		},
		longer: {
			type: 'regex',
			value: '(longer|more) (than|as)',
		},
		soon: {
			type: 'regex',
			value: 'soon|near future',
		},
		between: {
			type: 'regex',
			value: 'between',
		},
		// rainTypes
		light: {
			type: 'regex',
			value: 'light(ly)?|little|drizzle',
		},
		moderate: {
			type: 'regex',
			value: 'moderate(ly)?|normal',
		},
		heavy: {
			type: 'regex',
			value: 'heav(y|ily)|hard',
		},
		violent: {
			type: 'regex',
			value: 'violent(ly)|intense(ly)|extreme(ly)',
		},
	},
	group: {
		forTime: {
			set: 'for && TIME',
			allowDisconnect: false,
			ordered: true,
		},
		followingTime: {
			set: 'following && TIME',
			allowDisconnect: false,
			ordered: true,
		},
		longerTime: {
			set: 'longer && TIME',
			ordered: true,
		},
		altTime: {
			set: 'TIME',
		},
		betweenTime: {
			set: 'between && TIME && TIME',
			ordered: true,
		},
		rainType: {
			set: 'light || moderate || heavy || violent',
		},
		rainToken: {
			set: 'rain || umbrella || dry',
		},
		rainGroup: {
			set: '(rainType) && rainToken && (altTime) && (soon) && (followingTime) && (forTime) && (longerTime)',
			ordered: true,
		},
		main: {
			set: 'rainGroup && (negate)',
			capturingGroup: true,
		},
	},
};
