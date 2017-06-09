// Tell jslint that certain variables are global
/* global afqb, $ */

$('.ew-resize')
	.resizable({
		handles: "e",
		create: function () {
            "use strict";
            // Prefers an another cursor with two arrows
			// Choose between "col-resize" and "ew-resize"
            $(".ui-resizable-e").css("cursor", "col-resize");
        },
		resize: function () {
            "use strict";
			afqb.three.onWindowResize();
		}
	});

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
