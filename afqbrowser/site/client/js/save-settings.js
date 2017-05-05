afqb.global.saveSettings = function() {
	// Save the three settings
	afqb.three.settings.initCameraPosition = afqb.three.camera.position.clone();
	afqb.three.settings.initLHOpacity = afqb.global.controls.threeControlBox.lhOpacity;
	afqb.three.settings.initRHOpacity = afqb.global.controls.threeControlBox.rhOpacity;
	afqb.three.settings.initFiberOpacity = afqb.global.controls.threeControlBox.fiberOpacity;
	afqb.three.settings.mouseoverHighlight = afqb.global.controls.threeControlBox.highlight;

	// Convert to a json string
	var settingStr = JSON.stringify(afqb.three.settings);

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
	reader.onload = (function(theFile) {
		return function(e) {
			afqb.global.threeSettings = JSON.parse(e.target.result);
		};
	})(f);
	
	reader.readAsText(f);
	afqb.three.settings = afqb.global.threeSettings;
};

document.getElementById('load-settings')
	.addEventListener('change', afqb.global.readSettings, false);
