// Tell jslint that certain variables are global
/* global afqb, FileReader, d3, d3_queue, THREE */

afqb.global.formatKeyName = function(bundle) {
    // Standardize bundle names by making them lower case and
    // replacing all dots and spaces with dashes
    return bundle.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "-");
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
            afqb.table.settings.sort.key = afqb.table.settings.sort.key === '' ? null : afqb.table.settings.sort.key;
            afqb.table.settings.prevSort.key = afqb.table.settings.prevSort.key === '' ? null : afqb.table.settings.prevSort.key;
            afqb.table.settings.restoring = true;

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

            // Parse the brushes
            if (afqb.plots.settings.hasOwnProperty("brushes")) {
                Object.keys(afqb.plots.settings.brushes).forEach(function (bundle) {
                    if (afqb.plots.settings.brushes[bundle].hasOwnProperty("brushOn")
                        && typeof afqb.plots.settings.brushes[bundle].brushOn !== "boolean") {
                        afqb.plots.settings.brushes[bundle].brushOn = (
                            afqb.plots.settings.brushes[bundle].brushOn.toLowerCase() === "true"
                        );
                    }
                    if (afqb.plots.settings.brushes[bundle].hasOwnProperty("brushExtent")) {
                        afqb.plots.settings.brushes[bundle].brushExtent = afqb.plots.settings.brushes[bundle].brushExtent.map(parseFloat);
                    }
                });
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

            if (afqb.table.settings.selectedRows) {
                Object.keys(afqb.table.settings.selectedRows).forEach(function (subject) {
                    if (typeof afqb.table.settings.selectedRows[subject] !== "boolean") {
                        afqb.table.settings.selectedRows[subject] = (
                            afqb.table.settings.selectedRows[subject].toLowerCase() === "true"
                        );
                    }
                });
            }

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

            // Parse fiber representation
            afqb.three.settings.fiberRepresentation = afqb.three.settings.fiberRepresentation
                .split("-").join(" ");

            afqb.global.settings.loaded = true;

            if (callback) { callback(null); }
        });
	}
};

afqb.plots.restoreBrush = function () {
    "use strict";
    Object.keys(afqb.plots.settings.brushes).forEach(function (tract) {
        if (afqb.plots.settings.brushes[tract].brushOn) {
            var targetBrush = afqb.plots.brushes.filter(function (b) {
                return b.name === tract;
            })[0].brush;

            d3.selectAll("#tract-" + tract)
                .selectAll(".brush")
                .call(targetBrush.extent(
                    afqb.plots.settings.brushes[tract].brushExtent
                ));

            var formatter = d3.format(".0f");
            var ext = targetBrush.extent();
            d3.select("#brush-ext-" + tract).text("(" + formatter(ext[0]) + ", " + formatter(ext[1]) + ")");
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

var setupBinderURL = function () {
    // Parse the URL
    if (window.location.hostname == "localhost") {
      $("#launch-binder").addClass("disabled")
    }
    var uri = new URI(location.href);
    var user = uri.hostname().split('.')[0];
    var repo = uri.directory();
    var binderUrl = 'https://mybinder.org/v2/gh/' + user + '/' + repo + '/gh-pages?filepath=index.ipynb';
     $("#launch-binder").attr("href", binderUrl);
    return false;
}

setupBinderURL();
