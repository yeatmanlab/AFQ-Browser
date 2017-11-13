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

afqb.global.updateQueryString = function(queryObj) {
    "use strict";

    var urlSettings = Qs.parse(location.search.slice(1));
    var updatedSettings = $.extend(true, {}, urlSettings, queryObj);

    var settingsStr = "?" + Qs.stringify(updatedSettings, {encode: false});

    window.history.pushState({search: settingsStr}, '', settingsStr);
};

afqb.global.initSettings = function (callback) {
    "use strict";
    if (afqb.global.settings.loaded) {
        if (callback) { callback(null); }
	} else {
        // Load default settings from settings.json
        d3.json("settings.json", function(settings) {
            // Update with values from query string
            "use strict";
            var qsSettings = Qs.parse(location.search.slice(1));
            var updatedSettings = $.extend(true, {}, settings, qsSettings);

            afqb.three.settings = $.extend(true, {}, afqb.three.settings, updatedSettings.three);
            afqb.plots.settings = $.extend(true, {}, afqb.plots.settings, updatedSettings.plots);
            afqb.table.settings = $.extend(true, {}, afqb.table.settings, updatedSettings.table);
            afqb.global.settings = $.extend(true, {}, afqb.global.settings, updatedSettings.global);

            // Restore spaces and capitalized words in splitMethod
            afqb.table.settings.splitMethod = afqb.table.settings.splitMethod
                .split("-").map(function (word) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }).join(" ");

            // Parse all the checkbox strings as booleans
            Object.keys(afqb.plots.settings.checkboxes).forEach(function (bundle) {
                afqb.plots.settings.checkboxes[bundle] = (
                	afqb.plots.settings.checkboxes[bundle].toLowerCase() === 'true'
				);
            });

            // Parse the brushTract checkbox as boolean
            if (typeof afqb.plots.settings.brushTract !== 'boolean') {
                afqb.plots.settings.brushTract = (afqb.plots.settings.brushTract.toLowerCase() === 'true');
            }

            // Parse the zoom params as floats
            if (afqb.plots.settings.hasOwnProperty("zoom")) {
                Object.keys(afqb.plots.settings.zoom).forEach(function (key) {
                    if (afqb.plots.settings.zoom[key].hasOwnProperty("scale")) {
                        afqb.plots.settings.zoom[key].scale = parseFloat(afqb.plots.settings.zoom[key].scale);
                    }
                    if (afqb.plots.settings.zoom[key].hasOwnProperty("translate")) {
                        afqb.plots.settings.zoom[key].translate = afqb.plots
							.settings.zoom[key].translate.map(parseFloat);
                    }
                });
            }

			// Parse lineOpacity as float
			afqb.plots.settings.lineOpacity = parseFloat(afqb.plots.settings.lineOpacity);

			// Parse table sorting counts as ints
			afqb.table.settings.sort.count = parseInt(afqb.table.settings.sort.count);
            afqb.table.settings.prevSort.count = parseInt(afqb.table.settings.prevSort.count);

            // Parse three.js opacities as floats
			afqb.three.settings.rHOpacity = parseFloat(afqb.three.settings.rHOpacity);
            afqb.three.settings.lHOpacity = parseFloat(afqb.three.settings.lHOpacity);
            afqb.three.settings.fiberOpacity = parseFloat(afqb.three.settings.fiberOpacity);

            // Parse mouseoverHighlight as boolean
			if (afqb.three.settings.hasOwnProperty("mouseoverHighlight")) {
                if (typeof afqb.three.settings.mouseoverHighlight !== 'boolean') {
                    afqb.three.settings.mouseoverHighlight = (
                        afqb.three.settings.mouseoverHighlight.toLowerCase() === 'true'
                    );
                }
            }

            // Parse camera position as floats
			if (afqb.three.settings.hasOwnProperty("cameraPosition")) {
                Object.keys(afqb.three.settings.cameraPosition).forEach(function (coord) {
                    afqb.three.settings.cameraPosition[coord] = parseFloat(
                        afqb.three.settings.cameraPosition[coord]
                    )
                });
            }

            afqb.global.settings.loaded = true;
            if (callback) { callback(null); }
        });
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
			Object.assign(afqb.three.settings, settings.three);
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
			Object.assign(afqb.plots.settings, settings.plots);
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
			Object.assign(afqb.table.settings, settings.table);
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
    Object.keys(afqb.plots.settings.brushes).forEach(function (tract) {
        if (afqb.plots.settings.brushes[tract].brushOn) {
            var targetBrush = afqb.plots.brushes.filter(function (b) {
                return b.name === tract;
            })[0].brush;

            d3.selectAll("#" + tract)
                .selectAll(".brush")
                .call(targetBrush.extent(
                    afqb.plots.settings.brushes[tract].brushExtent
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
