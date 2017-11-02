// Define global `afqb` and set all other global variables as properties of
// afqb by direct assignment
/* exported afqb */

var afqb = {
	table: {
		settings: {}
	},
	plots: {
		settings: {}
	},
	three: {
		settings: {}
	},
	global: {
		mouse: {},
		queues: {},
		controls: {},
		qs: new QS(),
		settings: { //query string will manipulate settings
			html: {}
		},
		colors: {}
	}
};
