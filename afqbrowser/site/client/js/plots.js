// Tell jslint that certain variables are global
/* global afqb, d3, d3_queue, dat, $ */
/* eslint experimentalObjectRestSpread: true */

//tractlist js
afqb.plots.yzooms = {};
afqb.plots.zoomable = true;

afqb.plots.m = {top: 20, right: 10, bottom: 10, left: 25};
afqb.plots.w = 400 - afqb.plots.m.left - afqb.plots.m.right;
afqb.plots.h = 350 - afqb.plots.m.top - afqb.plots.m.bottom;
afqb.plots.axisOffset = {bottom: 40};

// init variable to hold data later
afqb.plots.tractData = d3.map();
afqb.plots.tractMean = d3.nest();
afqb.global.mouse.brushing = false;
afqb.plots.lastPlotKey = null;

// transition variable for consistency
afqb.plots.t = d3.transition().duration(750);

/**
 * Container function which calls other plots functions
 * once nodes.csv data has been read.
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 * @param useless - Obligatory callback argument that we don't use in the
 * function.
 * @param {data} data - JavaScript array created by d3.csv(data/nodes.csv).
 *
 */
afqb.plots.buildFromNodes = function (error, useless, data) {
	"use strict";
    afqb.plots.buildTractCheckboxes(error, data);
    afqb.three.initAndAnimate(error);
	afqb.plots.buildPlotGui(error, data);
	afqb.plots.ready(error, data);
	afqb.table.restoreRowSelection();
    afqb.plots.updateBrush();
    afqb.plots.restoreBrush();
    //afqb.plots.draw();
};

afqb.plots.brushes = [];

/**
 * Builds tract selection list in "Bundles" section. Reads
 * unique tract IDs from nodes.csv and creates selectable
 * text for each tract.
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 * @param {data} data - JavaScript array created by d3.csv(data/nodes.csv).
 */
afqb.plots.buildTractCheckboxes = function (error, data) {
	"use strict";
    if (error) { throw error; }

	// Read only the tractID field from nodes.csv
	afqb.plots.tracts = data.map(function (a) { return a.tractID; });
	// Get only the unique entries from the tract list
	afqb.plots.tracts = [...new Set(afqb.plots.tracts)];

	// Populate afqb.plots.settings.brushes using tract names
    if (!afqb.plots.settings.hasOwnProperty("brushes")) {
        afqb.plots.settings["brushes"] = {};
    }

    afqb.plots.tracts.forEach(function (element) {
        var tractName = afqb.global.formatKeyName(element);
        if (!afqb.plots.settings.brushes.hasOwnProperty(tractName)) {
            afqb.plots.settings.brushes[tractName] = {
            	brushOn: false,
				brushExtent: [0, 100]
			};
        }
    });

	//insert tractname checkboxes in the tractlist panel
	var svg = d3.select('#tractlist').selectAll(".input")
		.data(afqb.plots.tracts).enter().append('div');
	svg.append('input')
		.attr("type", "checkbox")
		.attr("class", "tracts")
		.attr("id", function (d) { return "input-" + afqb.global.formatKeyName(d); })
		.attr("name", function (d) { return afqb.global.formatKeyName(d); });
	// add label to the checkboxes
	svg.append('label')
		.text(function (d) { return d; })
		.attr("for", function (d) { return "input-" + afqb.global.formatKeyName(d); })
		.attr("id", function (d) { return "label-" + afqb.global.formatKeyName(d); });

	//add event handler to the checkbox
	d3.selectAll(".tracts")
		.on("change", function () {
			var state = this.checked;
			var name = this.name;
			//call tractdetails handler
			afqb.plots.settings.checkboxes[name] = state;
			afqb.plots.showHideTractDetails(state, name);
			afqb.three.highlightBundle(state, name);

			// Update the query string
			var checkboxes = {};
			checkboxes[name] = state;
			afqb.global.updateQueryString(
				{plots: {checkboxes: checkboxes}}
			);
		});

	Object.keys(afqb.plots.settings.checkboxes).forEach(function (key) {
		var checked = afqb.plots.settings.checkboxes[key];
        document.getElementById('input-' + key).checked = checked;
	});

	// all select/un-select all checkbox
	d3.selectAll("#selectAllTracts")
		.on("change", function () {
			var state = this.checked;
			if (state) {
				d3.selectAll("input.tracts").each(function () {
					this.checked = true;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);

                    // Update the query string
                    var checkboxes = {};
                    checkboxes[this.name] = this.checked;
                    afqb.global.updateQueryString(
                        {plots: {checkboxes: checkboxes}}
                    );
				});
			} else {
				d3.selectAll("input.tracts").each(function () {
					this.checked = false;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);

                    // Update the query string
                    var checkboxes = {};
                    checkboxes[this.name] = this.checked;
                    afqb.global.updateQueryString(
                        {plots: {checkboxes: checkboxes}}
                    );
				});
			}
		});

	var checked = true;
    d3.selectAll('input.tracts').each(function () {
        checked = checked && this.checked;
    });
    document.getElementById('selectAllTracts').checked = checked;
};

// initialize yScale and yAxis
afqb.plots.yScale = d3.scale.linear()
	.range([afqb.plots.h - afqb.plots.axisOffset.bottom, 0]);

afqb.plots.yAxis = d3.svg.axis()
	.scale(afqb.plots.yScale)
	.orient("left")
	.tickSize(0 - afqb.plots.w - 5)
	.ticks(5);

afqb.plots.xAxisScale = d3.scale.linear()
    .range([afqb.plots.m.left + 30, afqb.plots.w + afqb.plots.m.left + 20])
    .domain([0, 100]);

/**
 * Creates line object with appropriate domain and range for each tract.
 * Called for draw and transformation operations involving subject lines
 * or mean lines in the 2D plots.
 *
 * @param {data} d - Subject or mean data for 2D plot of selected metric
 * @param {string} id - formatted tract name
 */
afqb.plots.line = function (d, id){

	var line = d3.svg.line()
        .interpolate("basis")
        .x(function (d) {
            if (d.nodeID) {
                return afqb.plots.xScale[id](+d.nodeID);
            } else {
                return afqb.plots.xScale[id](+d.key);
            }
        })
        .y(function (d) {
            if (d[afqb.global.controls.plotsControlBox.plotKey]) {
                return afqb.plots.yScale(+d[afqb.global.controls.plotsControlBox.plotKey]);
            } else {
                return afqb.plots.yScale(+d.values.mean);
            }
        })
        .defined(function (d) {
            if (d[afqb.global.controls.plotsControlBox.plotKey]) {
                return !isNaN(d[afqb.global.controls.plotsControlBox.plotKey]);
            } else {
                return !isNaN(d.values.mean);
            }
        });
	return line(d)
};

/**
 * Creates area object with appropriate domain and range for each tract.
 * Called for draw and transformation operations involving standard deviation
 * and standard error in 2D plots.
 *
 * @param {data} d - Mean data for 2D plot of selected metric
 * @param {string} id - formatted tract name
 */
afqb.plots.area = function (d, id) {
	var area = d3.svg.area()
        .x(function(d) { return afqb.plots.xScale[id](+d.key) })
        .y0(function (d) {
            if (afqb.global.controls.plotsControlBox.errorType === 'stderr') {
                return afqb.plots.yScale(+d.values.mean - +d.values.stderr);
            } else {
                return afqb.plots.yScale(+d.values.mean - +d.values.std);
            }
        })
        .y1(function (d) {
            if (afqb.global.controls.plotsControlBox.errorType === 'stderr') {
                return afqb.plots.yScale(+d.values.mean + +d.values.stderr);
            } else {
                return afqb.plots.yScale(+d.values.mean + +d.values.std);
            }
        });
	return area(d)
};

/**
 * Builds control panel GUI for metric plots. Allows user
 * to select which metric to plot, error type (std err or
 * std dev) for shaded area, subject line opacity, and
 * whether or not brushing is allowed.
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 * @param {object} data - JavaScript object created by d3.csv(data/nodes.csv).
 */
afqb.plots.buildPlotGui = function (error, data) {
    "use strict";
	if (error) { throw error; }

    var nonMetricCols = ['subjectID', 'tractID', 'nodeID'];
    var nodeKeys = Object.keys(data[0]).filter(function (element) {
        return !nonMetricCols.includes(element);
    });

    var plotKey = nodeKeys.includes(afqb.plots.settings.plotKey) ? afqb.plots.settings.plotKey : nodeKeys[0];

	var plotsGuiConfigObj = function () {
		this.brushTract = afqb.plots.settings.brushTract;
		this.plotKey = plotKey;
		this.lineOpacity = parseFloat(afqb.plots.settings.lineOpacity);
        this.errorType = afqb.plots.settings.errorType;
	};

	afqb.plots.gui = new dat.GUI({
		autoplace: false,
		width: 250,
		scrollable: false
	});

	var plotsGuiContainer = document.getElementById('plots-gui-container');
	plotsGuiContainer.appendChild(afqb.plots.gui.domElement);

	afqb.global.controls.plotsControlBox = new plotsGuiConfigObj();

    // Add key controller
	afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'plotKey', nodeKeys)
		.name('Metric')
		.onChange(function (value) {
            d3.csv("data/nodes.csv", function(data, error) {
            	afqb.plots.changePlots(data, error);
                // update y label
                d3.selectAll(".y.label").remove();

                d3.select("#tractdetails").selectAll("svg").append("text")
                    .attr("text-anchor", "middle")
                    .attr("transform", "translate(" + (afqb.plots.m.left / 2 + 5) + "," +
                        ((afqb.plots.h + afqb.plots.m.top) / 2) + ")rotate(-90)")
                    .attr("class", "y label")
                    .style("stroke", "#888888;")
                    .text(function (d, i) { return value; });

                afqb.plots.zoomAxis();
            });
        })
		.onFinishChange(function(value) {
            // Update the query string
            afqb.global.updateQueryString(
                {plots: {plotKey: value}}
            );
		});

    // Add error controller
    afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'errorType', ['stderr', 'std'])
        .name('Error Type')
        .onChange(function () {
            d3.csv("data/nodes.csv", afqb.plots.changePlots);
        })
		.onFinishChange(function (value) {
            // Update the query string
            afqb.global.updateQueryString(
                {plots: {errorType: value}}
            );
		});

    // Add plot opacity controller
	afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'lineOpacity')
		.min(0).max(1)
		.name('Line Opacity')
		.onChange(function (value) {
                d3.select("#tractdetails")
                    .selectAll("svg").selectAll(".tracts")
                    .filter(function () {
                        return (afqb.table.settings.selectedRows[this.id] !== true);
                    })
                    .filter(function () {
                        return (this.id.indexOf("mean") === -1);
                    })
                    .select(".line")
                    .style("opacity", value);
		})
		.onFinishChange(function (value) {
            // Update the query string
            afqb.global.updateQueryString(
                {plots: {lineOpacity: value}}
            );
		});

    // Add brush controller
	afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'brushTract')
		.name('Brushable Tracts')
		.onChange(function () {
			afqb.plots.updateBrush();
            afqb.three.brushOn3D();
        })
		.onFinishChange(function (value) {
            // Update the query string
            afqb.global.updateQueryString(
                {plots: {brushTract: value}}
            );
		});

	afqb.plots.gui.close();
};

/**
 * Generates initial 2D plots. Turns nodes.csv into nested
 * json object. This object is used to determine x/y
 * range, plot subject lines, and calculate mean and
 * error for the default metric.
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 * @param {data} data - JavaScript array created by d3.csv(data/nodes.csv).
 */
afqb.plots.ready = function (error, data) {
    "use strict";
	if (error) { throw error; }

    var plotKey = afqb.global.controls.plotsControlBox.plotKey;
    afqb.plots.lastPlotKey = plotKey;


	data.forEach(function (d) {
		if (typeof d.subjectID === 'number') {
			d.subjectID = "s" + afqb.global.formatKeyName(d.subjectID.toString());
        } else {
			d.subjectID = afqb.global.formatKeyName(d.subjectID);
		}
	});

	data = data.filter(function (d) {
		return Boolean(d[plotKey]);
	});

	afqb.plots.tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

    // compute mean and error
    afqb.plots.tractMean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) {
            return {
                mean: d3.mean(v, function (d) {
                    return +d[plotKey];}),
                stderr: (d3.deviation(v, function (d) {
                    return +d[plotKey];
                }) || 0.0)/Math.sqrt(v.length),
                std: (d3.deviation(v, function (d) {
                    return +d[plotKey];
                }) || 0.0)
            };
        })
        .entries(data);

    // initialize xScale dict
    afqb.plots.xScale = {};

	// set x and y domains for the tract plots
    afqb.plots.tractData.forEach(function (d,i) {
    	/*var len = 1;
    	d.values.forEach(function (d){
    		if (d.values.length > len) {
    			len = d.values.length;
			}
		});*/
    	var len = afqb.plots.tractMean[i].values.length;
        var id = afqb.global.formatKeyName(afqb.plots.tracts[i]); // Subject to ordering errors since we call
        afqb.plots.xScale[id] = d3.scale.linear()
            .range([afqb.plots.m.left + 30, afqb.plots.w + afqb.plots.m.left + 20])
            .domain([0, len]);

    });

	afqb.plots.yScale.domain(d3.extent(data, function (d) {
		return +d[plotKey];
	}));

    afqb.plots.yAxis.scale(afqb.plots.yScale);

    afqb.plots.yzooms[plotKey] = d3.behavior.zoom()
        .y(afqb.plots.yScale)
        .on("zoom", afqb.plots.zoomable ? afqb.plots.zoomAxis : null)
        .on("zoomend",afqb.plots.zoomable ? afqb.plots.draw : null);

    // If we've already stored this type of plot's zoom settings, recover them
    if (afqb.plots.settings.zoom[plotKey]
        && afqb.plots.settings.zoom[plotKey].hasOwnProperty("scale")
        && afqb.plots.settings.zoom[plotKey].hasOwnProperty("translate")) {
        afqb.plots.yzooms[plotKey].scale(
            parseFloat(afqb.plots.settings.zoom[plotKey].scale) || 1);
        afqb.plots.yzooms[plotKey].translate(
            afqb.plots.settings.zoom[plotKey].translate.map(parseFloat) || [0, 0]);
    } else {
        // We need to store this for later use
        afqb.plots.settings.zoom[plotKey] = {};
        afqb.plots.settings.zoom[plotKey].scale = afqb.plots.yzooms[plotKey].scale();
        afqb.plots.settings.zoom[plotKey].translate = afqb.plots.yzooms[plotKey].translate();
    }

	//initialize panels for each tract - and attach tract data with them
	var trPanels = d3.select("#tractdetails").selectAll("svg").data(afqb.plots.tractData);
	trPanels.enter().append("svg")
		.attr("id", function (d,i) { return "tract-" + afqb.global.formatKeyName(afqb.plots.tracts[i]); })
        .attr("name", function (d,i) { return afqb.global.formatKeyName(afqb.plots.tracts[i]); })
		.attr("width", afqb.plots.w + afqb.plots.m.left + afqb.plots.m.right + 40)
		.attr("height", afqb.plots.h + afqb.plots.m.top + afqb.plots.m.bottom + afqb.plots.axisOffset.bottom)
		.attr("display", "none")
		.append("g")
		.attr("transform", "translate(" + afqb.plots.m.left + "," + afqb.plots.m.top + ")")
		//y-axis
		.append("g")
		.attr("class", "y axis")
		.attr("transform", "translate(" + afqb.plots.m.left + ",0)")
		.call(afqb.plots.yAxis);

    // y axis label
    trPanels.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ (afqb.plots.m.left/2+5) +","+
              ((afqb.plots.h+afqb.plots.m.top)/2)+")rotate(-90)")
        .attr("class", "y label")
        .style("stroke", "#888888;")
        .text(function (d,i) { return afqb.global.controls.plotsControlBox.plotKey});

    trPanels.append("svg:rect")
        .attr("class", "zoom y box")
        .attr("width", afqb.plots.m.left+20)
        .attr("height", afqb.plots.h - afqb.plots.m.top - afqb.plots.m.bottom)
        .style("visibility", "hidden")
        .attr("pointer-events", "all")
        .style("cursor", "row-resize")
        .call(afqb.plots.yzooms[plotKey]);

	//x-axis
	trPanels.select("g").each(function (d) {

        var g = d3.select(this);
        var id = afqb.global.formatKeyName(d.key);

		var xAxis = d3.svg.axis()
                .scale(afqb.plots.xAxisScale) //afqb.plots.xScale[id])
                .orient("bottom")
                .tickPadding(8)
                .ticks(5);

        g.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(-20," + (afqb.plots.h - afqb.plots.axisOffset.bottom) + ")")
            .call(xAxis);
    });

	trPanels.append("rect")
		.attr("class", "plot")
		.attr("width", afqb.plots.w + afqb.plots.m.left + afqb.plots.m.right + 30)
		.attr("height", afqb.plots.h + afqb.plots.m.top + afqb.plots.m.bottom + 15)
		.attr("x", 0)
		.attr("y", 0)
		.style("stroke", function (d,i) { return afqb.global.d3colors[i]; })
		.style("fill", "none")
		.style("stroke-width", 2);

    trPanels.append("text")
		.attr("class", "plot_text")
		.attr("text-anchor", "middle")
		.attr("transform", "translate("+ (afqb.plots.w-afqb.plots.m.left) +","+
              ((afqb.plots.h+afqb.plots.m.bottom+20))+")")
		.style("text-anchor", "end")
		.style("stroke", "#888888;")
		.text("% Distance Along Fiber Bundle");

    // add tract name to top corner
	trPanels.append("text")
		.attr("class", "plot_text")
		.attr("text-anchor", "end")
		.attr("transform", "translate("+ (afqb.plots.w + afqb.plots.m.right + 30)
              +","+(afqb.plots.m.top)+")")
		.style("stroke", function(d,i){return afqb.global.d3colors[i];} )
		.style("fill", function(d,i){return afqb.global.d3colors[i];} )
		.text(function(d,i) { return afqb.plots.tracts[i]; });

    trPanels.append("text")
        .attr("id", function (d,i) { return "brush-ext-" + afqb.global.formatKeyName(afqb.plots.tracts[i]); })
        .attr("class", "brushExt")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (afqb.plots.w + afqb.plots.m.right + 30)
            +","+(afqb.plots.m.top+15)+")")
        .style("stroke", function(d,i){return afqb.global.d3colors[i];} )
        .style("fill", function(d,i){return afqb.global.d3colors[i];} );

    // append g elements to each tract for error, subject lines, and mean lines
    trPanels.append("g").attr("id", "error-area");
    trPanels.append("g").attr("id", "subject-lines");
    trPanels.append("g").attr("id", "mean-lines");

	// associate tractsline with each subject
	trPanels.each(function (data) {

		var id = afqb.global.formatKeyName(data.key);

		var tractLines = d3.select(this).select("#subject-lines").selectAll(".tracts").data(data.values);
		tractLines.enter().append("g")
			.attr("class", "tracts")
            .attr("id", function (d) {
                return d.values[0].subjectID;
            })
						.on("mouseover", mouseover)
						.on("mousemove", mouseover)
						.on("mouseout", mouseout)
            .on("click", onclick);

		tractLines.append("path")
            .attr("class", "line")
            .attr("d", function (d) {return afqb.plots.line(d.values, id);})
            .style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
            .style("stroke-width", "1px");
	});

	// Select existing g element for error area
    d3.select("#tractdetails").selectAll("svg").select("#error-area")
        .datum(afqb.plots.tractMean)
        .attr("class", "tracts means")
        //.attr("id", "mean0")
		// Append error shading
		.append("path")
        .attr("class", "area")
        .attr("d", function(d,i) {
        	var id = afqb.global.formatKeyName(d[i].key);
        	return afqb.plots.area(d[i].values, id); })
        .style("opacity", 0.4);

    // Select existing g element for mean lines
    d3.select("#tractdetails").selectAll("svg").select("#mean-lines")
        .datum(afqb.plots.tractMean)
        .attr("class", "tracts means")
        //.attr("id", "mean0")
		// append mean lines
		.append("path")
        .attr("class", "line")
        .attr("d", function(d,i) {
            var id = afqb.global.formatKeyName(d[i].key);
        	return afqb.plots.line(d[i].values, id); })
        .style("opacity", 0.99)
        .style("stroke-width", "3px");

	// Define the div for the tooltip
	var tt = d3.select("#tractdetails").append("div")
	    .attr("class", "tooltip")
	    .style("opacity", 0);


	function mouseover(d) {
		if (!afqb.global.mouse.brushing) {
			if ($("path",this).css("stroke-width") === "1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "1.1px");

			}

			// save self as the 'this' for the mouseover function's context
			var self = this;

			// only show tooltip if mousing over selected lines
			if ($("path",this).css("stroke-width") === "2.1px") {

				// calculate the x,y coordinates close to the mouse
				var key = d3.select(self.parentNode).data()[0].key;
				var fkey = afqb.global.formatKeyName(key);
				var x0 = afqb.plots.xScale[fkey].invert(d3.mouse(this)[0]);
				var nodeIndex = Math.ceil(x0);
				var y0 = d.values[nodeIndex][afqb.global.controls.plotsControlBox.plotKey]

				// get the correct tract name for this plot
				var plotIdx = 0;
				afqb.plots.tractMean.forEach(function(val, idx){
					if (val.key === key){
						plotIdx = idx
					}
				});

				// store the sort key, used for coloring if the table is sorted
				var sortKey = afqb.table.settings.sort.key;

				// initialize the variable for the z score
				var z0 = {};

				// HACK: the structure of afqb.plots.tractMean varies depending on whether or not the table is sorted.
				// the check in the if statement checks whether or not we need to calculate z-scores against multiple groups
				if (Array.isArray(afqb.plots.tractMean[0].values[0].values)) {
					// for each group in afqb.plots.tractMean[plotIdx].values, calculate and score the y val
					afqb.plots.tractMean[plotIdx].values.forEach(function(val, idx, arr){
						z0[idx] = (y0 - val.values[nodeIndex].values.mean) / val.values[nodeIndex].values.std
						z0[idx] = d3.format(",.2f")(z0[idx])
					})
				} else {
					// the table has NOT been sorted, calculate only 1 z-score
					var val = afqb.plots.tractMean[plotIdx].values
					// console.log("val[nodeIndex]", val[nodeIndex], val)
					z0[0] = (y0 - val[nodeIndex].values.mean) / val[nodeIndex].values.std
					z0[0] = d3.format(",.2f")(z0[0])
				}

				// if the table hasn't been sorted, then afqb.table.groupScale and afqb.table.ramp are null.
				// define as functions that return default values
				if (afqb.table.groupScale === null){
					afqb.table.groupScale = function(){return 0}
				}

				if (afqb.table.ramp == null){
					afqb.table.ramp = function(){return "black"}
				}


				// get the subject's metadata from the table
				// used later to color the subject_id heading
				var tableVal = {};
				afqb.table.subData.forEach(function(val){
					if (val.subjectID === self.id){
						tableVal = val
					}
				});

				// select the tooltip, make it visible, format the HTML, and set the position
				d3.select("#tractdetails").select(".tooltip")
					.style("opacity", 1)
					.html(function(){
						// get the label color from the ramp and groupScale functions
						var labelColor = afqb.table.ramp(afqb.table.groupScale(tableVal[sortKey]));
						// Add the title text below:
						var h = '<div class="titleTip"><b style="color:COLOR">'.replace("COLOR",labelColor)+self.id+ "</b>" + "<br>Node: " + nodeIndex + '<br><hr></div>';
						// for each key in the z-score dict, format HTML
						var Nzkeys = Object.keys(z0).length
						for (key in z0){

							// if a color is needed, format the heading:
							if (sortKey){
								// TODO: this if for getting quantiles of sort key afqb.table.groupScale.quantiles()
								// JK: above line does'nt work anymore??
								console.log("afqb.table.groupScale", afqb.table.groupScale);
								var quantiles = []
								try {
									var Q = afqb.table.groupScale.quantiles(); //[0.5] //BRK this is just for tests. afqb.table.groupScale.quantiles() doesn't work??

									for (var i=0; i<Q.length; i += 1){
										quantiles.push(d3.format(",.2f")(Q[i]));
									}
								} catch (e) {
									console.log("no quantiles");
								} finally {

								}


								var sortHeading = sortKey

								if (key == 0) {
									if (quantiles[key]){
										sortHeading += ' < ' + quantiles[key];
									}

								} else if (key != Nzkeys - 1) {
									sortHeading = quantiles[key - 1] + " < " + sortHeading + " < " + quantiles[key];
								} else {
									if (quantiles[key - 1]){
										sortHeading = quantiles[key - 1] + " < " + sortHeading;
									}
								}
								h += '<span style="color:COLOR">SORT</span><br>'.replace("SORT", sortHeading).replace("COLOR", afqb.table.ramp(key))
							}

							// finally, add the z-score value
							h += '<div class="zTip"><span style="font-size:1.2em;margin-top=3px;">z = VAL</span><br></div>'.replace("VAL", z0[key]);
						}
						return h
					})
					.style("left", (d3.event.pageX) + "px")
					.style("top", (d3.event.pageY - 28) + "px");
			} // end if statement for tooltip

			if (afqb.global.mouse.isDown) {
				if ($("path",this).css("stroke-width") === "2.1px") {
                    afqb.table.settings.selectedRows[this.id] = false;
					//uses the opacity of the row for selection and deselection
					d3.selectAll('#' + this.id)
						.selectAll('path')
						.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
						.style("stroke-width", "1px");

					d3.selectAll('#' + this.id)
						.selectAll('g')
						.style("opacity", 0.3);

				} else {
                    afqb.table.settings.selectedRows[this.id] = true;
					d3.selectAll('#' + this.id)
						.selectAll('path')
						.style("opacity", 1)
						.style("stroke-width", "2.1px");

					d3.selectAll('#' + this.id)
						.selectAll('g')
						.style("opacity", 1);
				}

                // Update the query string
                var selectedRows = {};
                selectedRows[this.id] = afqb.table.settings.selectedRows[this.id];

                afqb.global.updateQueryString(
                    {table: {selectedRows: selectedRows}}
                );
			}
		}
	}

	function onclick() {
		if (!afqb.global.mouse.brushing) {
			if ($("path",this).css("stroke-width") === "2.1px") {
				// uses the stroke-width of the line clicked on
				// to determine whether to turn the line on or off
                afqb.table.settings.selectedRows[this.id] = false;

				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("stroke-width", "1.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 0.3);
			} else if ($("path",this).css("stroke-width") === "1.1px") {
                afqb.table.settings.selectedRows[this.id] = true;

				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "2.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 1);
			} else if ($("path",this).css("opacity") === afqb.global.controls.plotsControlBox.lineOpacity) {
                afqb.table.settings.selectedRows[this.id] = true;

				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "2.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 1);
			}

            // Update the query string
            var selectedRows = {};
            selectedRows[this.id] = afqb.table.settings.selectedRows[this.id];

            afqb.global.updateQueryString(
                {table: {selectedRows: selectedRows}}
            );
		}
	}

	function mouseout() {
		if (!afqb.global.mouse.brushing) {
			if ($("path",this).css("stroke-width") === "1.1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
					.style("stroke-width", "1px");

			}
			// remove the tooltip
			d3.select("#tractdetails").select(".tooltip")
				.style("opacity", 0);
		}
	}

    d3.select("#tractdetails").selectAll("svg").each(function (d) {
        afqb.plots.newBrush(afqb.global.formatKeyName(d.key));
    });
};

/**
 * Updates plots on sort or metric change. If data is
 * sorted, means are calculated for each group of subjects
 * defined by the sort. If metric changes, axes and means
 * are updated accordingly. Calls afqb.plots.draw() and
 * afqb.plots.zoomAxis().
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 * @param {data} data - JavaScript array created by d3.csv(data/nodes.csv).
 *
 */
afqb.plots.changePlots = function (error, data) {
    "use strict";
	if (error) { throw error; }

	var plotKey = afqb.global.controls.plotsControlBox.plotKey;

	afqb.plots.lastPlotKey = plotKey;

	data.forEach(function (d) {
		if (typeof d.subjectID === 'number'){
			d.subjectID = "s" + afqb.global.formatKeyName(d.subjectID.toString());
        } else {
            d.subjectID = afqb.global.formatKeyName(d.subjectID);
        }
	});

	data = data.filter(function (d) {
		return Boolean(d[plotKey]);
	});

	afqb.plots.tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

	if (afqb.table.splitGroups) {
		afqb.plots.tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return afqb.table.subGroups[d.subjectID]; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
				return{
					mean: d3.mean(v, function (d) {
                        return +d[plotKey];}),
					stderr: (d3.deviation(v, function (d,i) {
                        return +d[plotKey];
                    }) || 0.0)/Math.sqrt(v.length),
					std: (d3.deviation(v, function (d) {
                        return +d[plotKey];
                    }) || 0.0)
                };
            })
			.entries(data);

		for (let iTract = 0; iTract < afqb.plots.tractMean.length; iTract++) {
			let index = afqb.plots.tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				afqb.plots.tractMean[iTract].values.splice(index, 1);
			}
		}
	} else {
		afqb.plots.tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
                return{
                    mean: d3.mean(v, function (d) {
                        return +d[plotKey];}),
                    stderr: (d3.deviation(v, function (d) {
 						 return +d[plotKey];
                    }) || 0.0)/Math.sqrt(v.length),
                    std: (d3.deviation(v, function (d) {
 						 return +d[plotKey];
                    }) || 0.0)
				 };
			 })
			.entries(data);

		for (let iTract = 0; iTract < afqb.plots.tractMean.length; iTract++) {
			let index = afqb.plots.tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				afqb.plots.tractMean[iTract].values.splice(index, 1);
			}
		}
	}

	// update axes based on selected data
	afqb.plots.yScale.domain(d3.extent(data, function (d) {
		return +d[plotKey];
	}));

    afqb.plots.yAxis.scale(afqb.plots.yScale);

	// Select the section we want to apply our changes to
	var svg = d3.select("#tractdetails").selectAll("svg")
		.data(afqb.plots.tractData).transition();

	// update y zoom for new axis
	afqb.plots.yzooms[plotKey] = d3.behavior.zoom()
		.y(afqb.plots.yScale)
		.on("zoom", afqb.plots.zoomable ? afqb.plots.zoomAxis : null)
		.on("zoomend", afqb.plots.zoomable ? afqb.plots.draw : null);

	// If we've already stored this type of plot's zoom settings, recover them
	if (afqb.plots.settings.zoom[plotKey]) {
		afqb.plots.yzooms[plotKey].scale(
				parseFloat(afqb.plots.settings.zoom[plotKey].scale) || 1);
		afqb.plots.yzooms[plotKey].translate(
				afqb.plots.settings.zoom[plotKey].translate.map(parseFloat) || [0, 0]);
	} else {
		// We need to store this for later use
		afqb.plots.settings.zoom[plotKey] = {};
		afqb.plots.settings.zoom[plotKey].scale = afqb.plots.yzooms[plotKey].scale();
		afqb.plots.settings.zoom[plotKey].translate = afqb.plots.yzooms[plotKey].translate();
	}

	d3.select("#tractdetails").selectAll("svg")
		.selectAll(".zoom.y.box").call(afqb.plots.yzooms[plotKey]);//.remove();

	afqb.plots.draw();
    afqb.plots.zoomAxis();
};

/**
 * Redraws subject and mean lines after new metric or
 * group selections. Calls afqb.plots.zoomAxis().
 *
 */
afqb.plots.draw = function() {
    "use strict";
	var plotKey = afqb.global.controls.plotsControlBox.plotKey;

	// Update the zoom settings to reflect the latest zoom parameters
	afqb.plots.settings.zoom[plotKey].scale = afqb.plots.yzooms[plotKey].scale();
	afqb.plots.settings.zoom[plotKey].translate = afqb.plots.yzooms[plotKey].translate();

    // Update the query string
    var zoom = {};
    zoom[plotKey] = afqb.plots.settings.zoom[plotKey];
    afqb.global.updateQueryString(
        {plots: {zoom: zoom}}
    );

	// JOIN new data with old elements.
	var trLines = d3.select("#tractdetails").selectAll("svg").select("#subject-lines")
		.data(afqb.plots.tractData).selectAll(".tracts")
		.data(function (d) { return d.values; }).transition();
		//.select("#path").attr("d", function (d) { return d.values; });

	trLines.select("path")
		.duration(0)
		.attr("d", function (d) {
			var id = afqb.global.formatKeyName(d.values[0].tractID);
            return afqb.plots.line(d.values, id);
		});

    // Remove old meanlines
    d3.select("#tractdetails").selectAll("svg").select("#error-area").selectAll(".area").remove();
    d3.select("#tractdetails").selectAll("svg").select("#mean-lines").selectAll(".line").remove();
    if (afqb.table.splitGroups) {

        var meanLines = d3.select("#tractdetails").selectAll("svg")
            .selectAll(".means")
            .data(function (d) {
                return afqb.plots.tractMean.filter(function(element) {
                    return element.key === d.key;
                })[0].values;
            });

        // Join new afqb.plots.tractMean data with old meanLines elements
        d3.select("#tractdetails").selectAll("svg").select("#error-area").selectAll("path")
            .data(function (d) {
                return afqb.plots.tractMean.filter(function(element) {
                    return element.key === d.key;
                })[0].values;
            })
            .enter()
            //.attr("id", function(d) {
            	//return "mean" + d.key;})
			// Append error area
        	.append("path")
            .attr("class", "area")
            .attr("d", function(d) {
                var id = afqb.global.formatKeyName(this.parentNode.parentNode.id).replace('tract-', '');
                return afqb.plots.area(d.values, id); })
            .style("opacity", 0.25);

        d3.select("#tractdetails").selectAll("svg").select("#mean-lines").selectAll("path")
            .data(function (d) {
                return afqb.plots.tractMean.filter(function(element) {
                    return element.key === d.key;
                })[0].values;
            })
            .enter()
            //.attr("id", function(d) {
                //return "mean" + d.key;})
        	// Append mean lines
			.append("path")
            .attr("class", "line")
            .attr("d", function(d) {
                var id = afqb.global.formatKeyName(this.parentNode.parentNode.id).replace('tract-', '');
                return afqb.plots.line(d.values, id); })
            .style("opacity", 0.99)
            .style("stroke-width", "3px");

        // set mean colors
        afqb.table.subData.forEach(afqb.global.idColor); // color lines
        d3.select("#tractdetails").selectAll("svg").select("#error-area").selectAll(".area")
            .style("fill", function (d, i) { return afqb.table.ramp(i); });
        d3.select("#tractdetails").selectAll("svg").select("#mean-lines").selectAll(".line")
            .style("stroke", function (d, i) { return afqb.table.ramp(i); });
    } else {
        // Gray meanLines for unsorted 'Plot Type' change
        // Select existing g element for error area
        d3.select("#tractdetails").selectAll("svg").select("#error-area")
            .datum(afqb.plots.tractMean)
            .attr("class", "tracts means")
            //.attr("id", "mean0")
            // Append error shading
            .append("path")
            .attr("class", "area")
            .attr("d", function(d,i) {
                var id = afqb.global.formatKeyName(d[i].key);
                return afqb.plots.area(d[i].values, id); })
            .style("opacity", 0.4);

        // Select existing g element for mean lines
        d3.select("#tractdetails").selectAll("svg").select("#mean-lines")
            .datum(afqb.plots.tractMean)
            .attr("class", "tracts means")
            //.attr("id", "mean0")
            // append mean lines
            .append("path")
            .attr("class", "line")
            .attr("d", function(d,i) {
                var id = afqb.global.formatKeyName(d[i].key);
                return afqb.plots.line(d[i].values, id); })
            .style("opacity", 0.99)
            .style("stroke-width", "3px");
    }

    afqb.plots.zoomAxis();
};

/**
 * Updates y axis zoom on sort or metric change.
 *
 */
afqb.plots.zoomAxis = function () {
    "use strict";
	d3.selectAll('.y.axis').call(afqb.plots.yAxis);
};

/**
 * Initializes brush elements for 2D plots. Brush used to
 * highlight a portion of tract in the "Anatomy" panel.
 *
 * @param {string} name - formatted tract name.
 */
afqb.plots.newBrush = function (name) {
    "use strict";
    var brush = d3.svg.brush()
        .x(afqb.plots.xAxisScale)
        .on("brush", brushed)
		.on("brushstart", brushStart)
		.on("brushend", brushEnd);

    function brushed() {
        var targetName = this.parentElement.getAttribute("name");
        var targetBrush = afqb.plots.brushes.filter(function (b) {
            return b.name === targetName;
        })[0].brush;

		afqb.plots.settings.brushes[targetName].brushOn = !targetBrush.empty();
		if (targetBrush.empty()) {
			afqb.plots.settings.brushes[targetName].brushExtent = [0, 100];

			d3.select("#brush-ext-" + targetName).text("");
		} else {
		    afqb.plots.settings.brushes[targetName].brushExtent = targetBrush.extent();

            var formatter = d3.format(".0f");
            var ext = targetBrush.extent();
            d3.select("#brush-ext-" + targetName).text("(" + formatter(ext[0]) + ", " + formatter(ext[1]) + ")");
		}
	}

	function brushStart() {
		afqb.global.mouse.brushing = true;
	}

	function brushEnd() {
		afqb.global.mouse.brushing = false;

		afqb.three.brushOn3D();

        // Update the query string
        var targetName = this.parentElement.getAttribute("name");
        var brushes = {};
        brushes[targetName] = afqb.plots.settings.brushes[targetName];
        afqb.global.updateQueryString(
            {plots: {brushes: brushes}}
        );
	}

    afqb.plots.brushes.push({name: name, brush: brush});
};

/**
 * Updates brush elements for 2D plots. Brush used to
 * highlight a portion of tract in the "Anatomy" panel.
 *
 */
afqb.plots.updateBrush = function () {
    "use strict";
	if (afqb.global.controls.plotsControlBox.brushTract) {
        var callBrush = function () {
            var targetName = this.parentElement.getAttribute("name");
            var targetBrush = afqb.plots.brushes.filter(function (b) {
                return b.name === targetName;
            })[0].brush;
            d3.select(this).call(targetBrush);
        };

		var brushg = d3.select("#tractdetails").selectAll("svg")
			.append("g")
			.attr("class", "brush")
			.each(callBrush);

		brushg.selectAll("rect")
			.attr("y", afqb.plots.m.top)
			.attr("height", afqb.plots.h - afqb.plots.axisOffset.bottom);

	} else {
		d3.selectAll(".brush").data([]).exit().remove();
        // Object.keys(afqb.plots.settings.brushes).forEach(function (bundle) {
        //     afqb.plots.settings.brushes[bundle].brushExtent = [0, 100];
        // });
	}
};

/**
 * Controls whether or not a plot is displayed for a given
 * tract, and changes color of the label in the "Bundles"
 * panel.
 *
 * @param {boolean} state - true if the tract is selected,
 * false if it is hidden.
 * @param {string} name - formatted tract name
 */
afqb.plots.showHideTractDetails = function (state, name) {
    "use strict";
	if (state === true){
		d3.select("#tract-" + name).style("display", "inline");
		var names = afqb.plots.tracts.map(function(name) {
			return afqb.global.formatKeyName(name);
		});
		var index = names.indexOf(name);
		var color = afqb.global.d3colors[parseInt(index)];
		d3.select("#label-" + name).style("color", color);
	} else {
		d3.select("#tract-" + name).style("display", "none");
		d3.select("#label-" + name).style("color", "#111111");
	}
};

/**
 * Initialize the selectable tract list.
 *
 * @param error - Passed to prevent execution in case error occurs
 * in preceding functions.
 */
afqb.plots.initCheckboxes = function (error) {
    "use strict";
    if (error) { throw error; }

    d3.selectAll("input.tracts").each(function() {
        var name = d3.select(this).attr("name");
        var state = afqb.plots.settings.checkboxes[name];
        afqb.plots.showHideTractDetails(state, name);
        afqb.three.highlightBundle(state, name);
    });

    $('body').addClass('loaded');
};

afqb.global.queues.nodeQ = d3_queue.queue();
afqb.global.queues.nodeQ.defer(afqb.global.initSettings);
afqb.global.queues.nodeQ.defer(d3.csv, "data/nodes.csv");
afqb.global.queues.nodeQ.await(afqb.plots.buildFromNodes);
