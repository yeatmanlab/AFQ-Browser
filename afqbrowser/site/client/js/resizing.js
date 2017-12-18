// Tell jslint that certain variables are global
/* global afqb, $ */

// Change the cursor type for the ew-resize lines
// And each time a panel is resized left-right (aka east-west), resize the threejs container
$('.ew-resize')
	.resizable({
		handles: "e",
		create: function () {
            "use strict";
            // Prefers another cursor with two arrows
			// Choose between "col-resize" and "ew-resize"
            $(".ui-resizable-e").css("cursor", "col-resize");
        },
		resize: function () {
            "use strict";
			afqb.three.onWindowResize();
		}
	});

// Same as above but for north-south
$('.ns-resize')
	.resizable({
		handles: "s",
		create: function () {
            "use strict";
            // Prefers an another cursor with two arrows
			// Choose between "col-resize" and "ns-resize"
            $(".ui-resizable-s").css("cursor", "row-resize");
        },
		resize: function () {
            "use strict";
			afqb.three.onWindowResize();
		}
	});
