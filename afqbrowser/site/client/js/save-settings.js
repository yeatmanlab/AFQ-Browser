// Tell jslint that certain variables are global
/* global afqb, FileReader, d3, d3_queue, THREE */

/**
 * Use universal key name for robust linking between elements
 *
 * @param {string} bundle - bundle name
 */
afqb.global.formatKeyName = function(bundle) {
    "use strict";
    // Standardize bundle names by making them lower case and
    // replacing all dots and spaces with dashes
    return bundle.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "-");
};

/**
 * Updates the QuerySting object for proper reload
 *
 * @param {object} queryObj - object to stringify and merge with existing query string
 */
afqb.global.updateQueryString = function(queryObj) {
    "use strict";
    // Pull down the current query string
    var urlSettings = Qs.parse(location.search.slice(1));

    // Extend the existing query string obj with the input obj
    var updatedSettings = $.extend(true, {}, urlSettings, queryObj);

    // Convert back to a query string
    var settingsStr = "?" + Qs.stringify(updatedSettings, {encode: false});

    // Push back up to the URL
    window.history.pushState({search: settingsStr}, '', settingsStr);
};

/**
 * Initialize settings from querystring.
 *
 * AFQ-Browser settings are stored in four places, corresponding to the
 * different visualization panels (naming is self-explanatory):
 *
 * - afqb.three.settings
 * - afqb.plots.settings
 * - afqb.table.settings
 * - afqb.global.settings
 *
 * In the query string, all settings are lumped together. So we must parse
 * the query string and separate settings into their different groups.
 *
 * @param callback - function to call after the settings have been loaded
 */
afqb.global.initSettings = function (callback) {
    "use strict";
    if (afqb.global.settings.loaded) {
        // Don't load settings again if called twice on accident
        if (callback) { callback(null); }
	} else {
        // Load default settings from settings.json
        d3.json("settings.json", function(settings) {
            "use strict";
            // Update with values from query string
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

/**
 * Restore brush settings on reload.
 *
 * Brush settings are stored in afqb.plots.settings.brushes. Iterate through
 * that and restore the brush extents.
 */
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

/**
 * Restore selected rows and subject lines on reload.
 *
 * This function iterates over afqb.table.settings.selectedRows and
 * changes the opacity of the associated table rows and plot lines.
 */
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

/**
 * Set the binder URL for the launch binder button
 *
 * If on localhost, disable the binder button. Otherwise, assume we're on
 * github pages and inspect the current URL to get the github user and repo.
 * Use that info to structure the binder URL. Then set the launch-binder
 * buttons href to the new binder URL
 */
var setupBinderURL = function () {
    // Disable the button if on localhost
    if (window.location.hostname == "localhost") {
      $("#launch-binder").addClass("disabled")
    }

    // Parse the URL, getting user and repo name
    var uri = new URI(location.href);
    var user = uri.hostname().split('.')[0];
    var repo = uri.directory();

    // Construct binder URL and set the button's href
    var binderUrl = 'https://mybinder.org/v2/gh/' + user + '/' + repo + '/gh-pages?filepath=index.ipynb';
     $("#launch-binder").attr("href", binderUrl);
    return false;
}

setupBinderURL();
