$('.ew-resize')
	.resizable({
		handles: "e",
		create: function( event, ui ) {
            // Prefers an another cursor with two arrows
			// Choose between "col-resize" and "ew-resize"
            $(".ui-resizable-e").css("cursor","col-resize");
        },
		resize: function( event, ui) {
			onWindowResize();
		}
	});

$('.ns-resize')
	.resizable({
		handles: "s",
		create: function( event, ui ) {
            // Prefers an another cursor with two arrows
			// Choose between "col-resize" and "ns-resize"
            $(".ui-resizable-s").css("cursor","row-resize");
        },
		resize: function( event, ui) {
			onWindowResize();
		}
	});
