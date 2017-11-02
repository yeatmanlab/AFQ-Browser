// Tell jslint that certain variables are global
/* global afqb, FileReader, d3, d3_queue, THREE */

afqb.global.saveSettings = function () {
	"use strict";
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
    settings.global = afqb.global.settings;

	// Convert to a json string
	var settingStr = JSON.stringify(settings);
	afqb.global.qs.set("settings", settingStr)
	//Object.keys(settings).forEach(function(key, idx, arr){
	//		afqb.global.qs.set(key, settings[key])
	//})

	window.history.pushState({
        path: afqb.global.qs.url
      }, '', afqb.global.qs.url);

	// Download a string to a file
	function download(filename, text) {
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

function setSettings(settings){
	afqb.three.settings = settings.three;
	afqb.plots.settings = settings.plots;
	afqb.table.settings = settings.table;
	afqb.global.settings = settings.global;
	afqb.global.settings.loaded = true;
}

afqb.global.initSettings = function () {
    "use strict";
    // replace here w/ QS
		var params = afqb.global.qs.getAll()
		console.log("Parameter settings from QS are:", params.settings)

		if (params["settings"]){
			var settings = JSON.parse(params["settings"])
			console.log("parsed settings are", settings)
			setSettings(settings)
		} else {
			d3.json("settings.json", function(settings) {
				setSettings(settings)
			});
		}

};

afqb.global.waitForSettings = function(callback) {
	  // questionable func
    "use strict";
    if (afqb.global.settings.loaded !== true) {
        setTimeout(function () {
            console.log("Waiting for settings to load...");
            afqb.global.waitForSettings(callback);
        }, 250);
    } else {
        callback(null);
        console.log("Settings loaded!");
    }
};

afqb.global.readSettings = function (evt) {
	"use strict";
    var files = evt.target.files; // FileList object

	// There should be only one file
	var f = files[0];

	var reader = new FileReader();
	reader.onload = function (event) {
		var settings = JSON.parse(event.target.result);

		var q = d3_queue.queue();

		function loadThree(callback) {
			// Restore 3D settings
			afqb.three.settings = settings.three;
			afqb.three.camera.position.copy(new THREE.Vector3(
				afqb.three.settings.cameraPosition.x,
				afqb.three.settings.cameraPosition.y,
				afqb.three.settings.cameraPosition.z
            ));
			afqb.global.controls.threeControlBox.lhOpacity = afqb.three.settings.lHOpacity;
			afqb.global.controls.threeControlBox.rhOpacity = afqb.three.settings.rHOpacity;
			afqb.global.controls.threeControlBox.fiberOpacity = afqb.three.settings.fiberOpacity;
			afqb.global.controls.threeControlBox.highlight = afqb.three.settings.mouseoverHighlight;
			afqb.global.updateGui(afqb.three.gui, afqb.global.controls.threeControlBox);
            callback(null);
		}

		function loadPlots(callback) {
			// Restore plot settings
            // Call updateBrush before restoreBrush to ensure that
            // afqb.plot.brushes is instantiated before calling it in
            // restoreBrush.
			afqb.plots.updateBrush();
            // Remove the old brush groups
            d3.selectAll(".brush").data([]).exit().remove();
            // Transfer settings
			afqb.plots.settings = settings.plots;
            // Check all the right boxes
            Object.keys(afqb.plots.settings.checkboxes).forEach(function (bundle) {
                var myBundle = d3.selectAll("input.tracts")[0][bundle];
				myBundle.checked = afqb.plots.settings.checkboxes[bundle];
				afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
				afqb.three.highlightBundle(myBundle.checked, myBundle.name);

            });
			afqb.global.controls.plotsControlBox.brushTract = afqb.plots.settings.brushTract;
			afqb.global.controls.plotsControlBox.plotKey = afqb.plots.settings.plotKey;
			afqb.global.controls.plotsControlBox.lineOpacity = afqb.plots.settings.lineOpacity;
            afqb.global.controls.plotsControlBox.errorType = afqb.plots.settings.errorType;

			afqb.global.updateGui(afqb.plots.gui, afqb.global.controls.plotsControlBox);
			afqb.plots.restoreBrush();
            callback(null);
		}

		function loadTable(callback) {
			// Restore table settings
			afqb.table.settings = settings.table;
			afqb.global.controls.tableControlBox.groupCount = afqb.table.settings.sort.count;
			afqb.table.settings.prevSort.key = afqb.table.settings.sort.key;
			afqb.table.settings.prevSort.count = afqb.table.settings.sort.count;
			if (afqb.table.settings.sort.order === "ascending") {
				afqb.table.settings.prevSort.order = "ascending";
				afqb.table.settings.sort.order = "descending";
			} else {
				afqb.table.settings.prevSort.order = "descending";
				afqb.table.settings.sort.order = "ascending";
			}
			afqb.table.settings.restoring = true;
			afqb.global.updateGui(afqb.table.gui, afqb.global.controls.tableControlBox);
            afqb.table.refreshTable();
			afqb.table.restoreRowSelection();
            callback(null);
		}

		q.defer(loadPlots);
		q.defer(loadThree);
		q.defer(loadTable);
		q.await(function (error) {
			if (error) { throw error; }
            afqb.global.updateHeadings();
            afqb.plots.zoomAxis();
		});
	};

	reader.readAsText(f);

    // We want the user to be able to reload the same settings file
    // So we scrub the input element's fileList by setting its value to ""
    document.getElementById('load-settings').value = "";
};

afqb.plots.restoreBrush = function () {
	"use strict";
    Object.keys(afqb.plots.settings.bundleBrush).forEach(function (tract) {
        if (afqb.plots.settings.bundleBrush[tract].brushOn) {
            var targetBrush = afqb.plots.brushes.filter(function (b) {
                return b.id === tract;
            })[0].brush;
            d3.selectAll("#" + tract)
                .selectAll(".brush")
                .call(targetBrush.extent(
                    afqb.plots.settings.bundleBrush[tract].brushExtent
                ));
        }
    });
};

afqb.table.restoreRowSelection = function () {
    "use strict";
    Object.keys(afqb.table.settings.selectedRows).forEach(function (rowID) {
        if (afqb.table.settings.selectedRows[rowID]) {
            d3.selectAll('#' + rowID)
                .selectAll('g')
                .style("opacity", 1);

            d3.selectAll('#' + rowID)
                .selectAll('path')
                .style("opacity", 1)
                .style("stroke-width", "2.1px");
        }
    });
};

afqb.global.updateGui = function (gui, controlBox) {
	"use strict";
    gui.__controllers.forEach(function (controller) {
		controller.setValue(controlBox[controller.property]);
		controller.updateDisplay();
	});
};

document.getElementById('load-settings')
	.addEventListener('change', afqb.global.readSettings, false);

afqb.global.initSettings();
