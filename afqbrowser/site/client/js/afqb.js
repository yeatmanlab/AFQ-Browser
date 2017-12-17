// Define global `afqb` and set all other global variables as properties of
// afqb by direct assignment
/* exported afqb */

// AFQ-Browser uses the global afqb object to share state between different elements of the application
var afqb = {
	// table contains stuff for the metadata table
	table: {
		settings: {},
		groupScale: null,
	},
	// plots contains stuff for the 2D plots
	plots: {
		settings: {}
	},
	// three contains stuff for the 3D anatomy panel
	three: {
		settings: {}
	},
	// global contains shared stuff
	global: {
		mouse: {},
		queues: {},
		controls: {},
		settings: {
			html: {}
		},
		colors: {}
	}
};
