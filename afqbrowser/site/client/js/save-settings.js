afqb.global.saveSettings = function() {
	// Save the three settings
	afqb.three.settings.initCameraPosition = afqb.three.camera.position.clone();
	afqb.three.settings.initLHOpacity = afqb.global.controls.threeControlBox.lhOpacity;
	afqb.three.settings.initRHOpacity = afqb.global.controls.threeControlBox.rhOpacity;
	afqb.three.settings.initFiberOpacity = afqb.global.controls.threeControlBox.fiberOpacity;
	afqb.three.settings.mouseoverHighlight = afqb.global.controls.threeControlBox.highlight;

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
		afqb.three.settings = settings.three;
		afqb.three.camera.position.copy(new THREE.Vector3(
					afqb.three.settings.initCameraPosition.x,
					afqb.three.settings.initCameraPosition.y,
					afqb.three.settings.initCameraPosition.z));
		afqb.global.controls.threeControlBox.lhOpacity = afqb.three.settings.initLHOpacity;
		afqb.global.controls.threeControlBox.rhOpacity = afqb.three.settings.initRHOpacity;
		afqb.global.controls.threeControlBox.fiberOpacity = afqb.three.settings.initFiberOpacity;
		afqb.global.controls.threeControlBox.highlight = afqb.three.settings.mouseoverHighlight;

		afqb.plots.settings = settings.plots;
		for (bundle in afqb.plots.settings.checkboxes) {
			if (afqb.plots.settings.checkboxes.hasOwnProperty(bundle)) {
				var myBundle = d3.selectAll("input.tracts")[0][bundle];
				myBundle.checked = afqb.plots.settings.checkboxes[bundle];
				afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
				afqb.three.highlightBundle(myBundle.checked, myBundle.name);
			}
		}

		afqb.table.settings = settings.table;
		afqb.global.controls.tableControlBox.groupCount = afqb.table.settings.sort.count;
		afqb.table.settings.prevSort = {};
		afqb.table.refreshTable();
	};

	reader.readAsText(f);
};

document.getElementById('load-settings')
	.addEventListener('change', afqb.global.readSettings, false);
