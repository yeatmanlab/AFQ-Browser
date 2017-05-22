afqb.global.saveSettings = function() {
	// Save the three settings
	afqb.three.settings.cameraPosition = afqb.three.camera.position.clone();
	afqb.three.settings.lHOpacity = afqb.global.controls.threeControlBox.lhOpacity;
	afqb.three.settings.rHOpacity = afqb.global.controls.threeControlBox.rhOpacity;
	afqb.three.settings.fiberOpacity = afqb.global.controls.threeControlBox.fiberOpacity;
	afqb.three.settings.mouseoverHighlight = afqb.global.controls.threeControlBox.highlight;

	afqb.plots.settings.brushTract = afqb.global.controls.plotsControlBox.brushTract;
	afqb.plots.settings.plotKey = afqb.global.controls.plotsControlBox.plotKey;
	afqb.plots.settings.lineOpacity = afqb.global.controls.plotsControlBox.lineOpacity;

	var settings = {};
	settings.three = afqb.three.settings;
	settings.plots = afqb.plots.settings;
	settings.table = afqb.table.settings;

	// Convert to a json string
	var settingStr = JSON.stringify(settings);

	// Download a string to a file
	function download (filename, text) {
		var pom = document.createElement('a');
		pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		pom.setAttribute('download', filename);

		if (document.createEvent) {
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		} else {
			pom.click();
		}
	}

	// Download the settings string to settings.json
	download("settings.json", settingStr);
};

afqb.global.readSettings = function(evt) {
	var files = evt.target.files; // FileList object

	// There should be only one file
	var f = files[0];

	var reader = new FileReader();
	reader.onload = function(event) {
		var settings = JSON.parse(event.target.result);

		// Restore 3D settings
		afqb.three.settings = settings.three;
		afqb.three.camera.position.copy(new THREE.Vector3(
					afqb.three.settings.cameraPosition.x,
					afqb.three.settings.cameraPosition.y,
					afqb.three.settings.cameraPosition.z));
		afqb.global.controls.threeControlBox.lhOpacity = afqb.three.settings.lHOpacity;
		afqb.global.controls.threeControlBox.rhOpacity = afqb.three.settings.rHOpacity;
		afqb.global.controls.threeControlBox.fiberOpacity = afqb.three.settings.fiberOpacity;
		afqb.global.controls.threeControlBox.highlight = afqb.three.settings.mouseoverHighlight;
		afqb.global.updateGui(afqb.three.gui, afqb.global.controls.threeControlBox);

		// Restore plot settings
		afqb.plots.settings = settings.plots;
		for (bundle in afqb.plots.settings.checkboxes) {
			if (afqb.plots.settings.checkboxes.hasOwnProperty(bundle)) {
				var myBundle = d3.selectAll("input.tracts")[0][bundle];
				myBundle.checked = afqb.plots.settings.checkboxes[bundle];
				afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
				afqb.three.highlightBundle(myBundle.checked, myBundle.name);
			}
		}
		afqb.global.controls.plotsControlBox.brushTract = afqb.plots.settings.brushTract;
		afqb.global.controls.plotsControlBox.plotKey = afqb.plots.settings.plotKey;
		afqb.global.controls.plotsControlBox.lineOpacity= afqb.plots.settings.lineOpacity;
		afqb.global.updateGui(afqb.plots.gui, afqb.global.controls.plotsControlBox);
		// Call updateBrush before restoreBrush to ensure that afqb.plot.brush
		// is instantiated before calling it in restoreBrush.
		afqb.plots.updateBrush();
		afqb.plots.restoreBrush();

		// Restore table settings
		afqb.table.settings = settings.table;
		afqb.global.controls.tableControlBox.groupCount = afqb.table.settings.sort.count;
		afqb.table.settings.prevSort.key = afqb.table.settings.sort.key;
		afqb.table.settings.prevSort.count = afqb.table.settings.sort.count;
		if (afqb.table.settings.sort.order == "ascending") {
			afqb.table.settings.prevSort.order = "ascending";
			afqb.table.settings.sort.order = "descending";
		} else {
			afqb.table.settings.prevSort.order = "descending";
			afqb.table.settings.sort.order = "ascending";
		}
		afqb.table.settings.restoring = true;
		afqb.global.updateGui(afqb.table.gui, afqb.global.controls.tableControlBox);
	};

	reader.readAsText(f);
};

afqb.plots.restoreBrush = function() {
	for (var tract in afqb.plots.settings.bundleBrush) {
	    if (afqb.plots.settings.bundleBrush.hasOwnProperty(tract)) {
			if (afqb.plots.settings.bundleBrush[tract].brushOn) {
				d3.selectAll("#" + tract)
					.selectAll(".brush")
					.call(afqb.plots.brush.extent(
								afqb.plots.settings.bundleBrush[tract].brushExtent));
			}
		}
	}
};

afqb.global.updateGui = function(gui, controlBox) {
	gui.__controllers.forEach(function (controller) {
		controller.setValue(controlBox[controller.property]);
		controller.updateDisplay();
	});
};

document.getElementById('load-settings')
	.addEventListener('change', afqb.global.readSettings, false);
