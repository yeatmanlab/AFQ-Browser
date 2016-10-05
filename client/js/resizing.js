$('.resizable')
	.resizable({
		handles: "e",
		create: function( event, ui ) {
            // Prefers an another cursor with two arrows
			// Choose between "col-resize" and "ew-resize"
            $(".ui-resizable-e").css("cursor","col-resize");
        }
	});
