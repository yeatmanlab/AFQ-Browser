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

afqb.plots.buildFromNodes = function (error, useless, data) {
	"use strict";
    afqb.plots.buildTractCheckboxes(error, data);
    afqb.three.initAndAnimate(error);
	afqb.plots.buildPlotGui(error, data);
	afqb.plots.ready(error, data);
    afqb.plots.updateBrush();
    afqb.plots.restoreBrush();
    //afqb.plots.draw();
};

afqb.plots.brushes = [];

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

afqb.plots.area = function (d,id) {
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

afqb.plots.ready = function (error, data) {
    "use strict";
	if (error) { throw error; }

	data.forEach(function (d) {
		if (typeof d.subjectID === 'number') {
			d.subjectID = "s" + afqb.global.formatKeyName(d.subjectID.toString());
        } else {
			d.subjectID = afqb.global.formatKeyName(d.subjectID);
		}
	});

	var plotKey = afqb.global.controls.plotsControlBox.plotKey;

	data = data.filter(function (d) {
		return Boolean(d[plotKey]);
	});

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

	afqb.plots.lastPlotKey = plotKey;

	afqb.plots.tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

    // initialize xScale dict
    afqb.plots.xScale = {};

	// set x and y domains for the tract plots
    afqb.plots.tractData.forEach(function (d,i) {
    	var len = 1;
    	d.values.forEach(function (d,i){
    		if (d.values.length > len) {
    			len = d.values.length;
			}
		});
		console.log(len);
        var id = afqb.plots.tracts[i].toLowerCase().replace(/\s+/g, "-"); // Subject to ordering errors since we call
        afqb.plots.xScale[id] = d3.scale.linear()
            .range([afqb.plots.m.left + 30, afqb.plots.w + afqb.plots.m.left + 20])
            .domain([0, len]);

    });

	afqb.plots.yScale.domain(d3.extent(data, function (d) {
		return +d[plotKey];
	}));

    afqb.plots.yAxis.scale(afqb.plots.yScale);

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
		var id = d.key.toLowerCase().replace(/\s+/g, "-");

		var xAxis = d3.svg.axis()
                .scale(afqb.plots.xScale[id])
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

	// associate tractsline with each subject
	trPanels.each(function (d) {

		var id = d.key.toLowerCase().replace(/\s+/g, "-");
		var data = d;

		var tractLines = d3.select(this).selectAll(".tracts").data(data.values);
		tractLines.enter().append("g")
			.attr("class", "tracts")
            .attr("id", function (d) {
                return d.values[0].subjectID;
            })
            .on("mouseover", mouseover)
            .on("mouseout", mouseout)
            .on("click", onclick);

		tractLines.append("path")
            .attr("class", "line")
            .attr("d", function (d) {return afqb.plots.line(d.values,id);})
            .style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
            .style("stroke-width", "1px");

	});

    // compute mean line
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

	var meanLines = d3.select("#tractdetails").selectAll("svg")
		.append("g")
		.datum(afqb.plots.tractMean)
		.attr("class", "tracts means")
		.attr("id", "mean0");

    meanLines.append("path")
        .attr("class", "area")
        .attr("d", function(d,i) {
        	var id = d[i].key.toLowerCase().replace(/\s+/g, "-");
        	return afqb.plots.area(d[i].values, id); })
        .style("opacity", 0.4);

    meanLines.append("path")
        .attr("class", "line")
        .attr("d", function(d,i) {
            var id = d[i].key.toLowerCase().replace(/\s+/g, "-");
        	return afqb.plots.line(d[i].values, id); })
        .style("opacity", 0.99)
        .style("stroke-width", "3px");

	function mouseover() {
		if (!afqb.global.mouse.brushing) {
			if ($("path",this).css("stroke-width") === "1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "1.1px");
			}
			if (afqb.global.mouse.isDown) {
				if ($("path",this).css("stroke-width") === "2.1px") {
					//uses the opacity of the row for selection and deselection
					d3.selectAll('#' + this.id)
						.selectAll('path')
						.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
						.style("stroke-width", "1px");

					d3.selectAll('#' + this.id)
						.selectAll('g')
						.style("opacity", 0.3);

				} else {
					d3.selectAll('#' + this.id)
						.selectAll('path')
						.style("opacity", 1)
						.style("stroke-width", "2.1px");

					d3.selectAll('#' + this.id)
						.selectAll('g')
						.style("opacity", 1);
				}
			}
		}
	}

	function onclick() {
		if (!afqb.global.mouse.brushing) {
			if ($("path",this).css("stroke-width") === "2.1px") {
				// uses the stroke-width of the line clicked on
				// to determine whether to turn the line on or off
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("stroke-width", "1.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 0.3);

			} else if ($("path",this).css("stroke-width") === "1.1px") {
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "2.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 1);
			} else if ($("path",this).css("opacity") === afqb.global.controls.plotsControlBox.lineOpacity) {
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "2.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 1);
			}
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
		}
	}

    d3.select("#tractdetails").selectAll("svg").each(function (d) {
        afqb.plots.newBrush(afqb.global.formatKeyName(d.key));
    });
};

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
	var trLines = d3.select("#tractdetails").selectAll("svg")
		.data(afqb.plots.tractData).selectAll(".tracts")
		.data(function (d) { return d.values; }).transition();
		//.select("#path").attr("d", function (d) { return d.values; });

	trLines.select("path")
		.duration(0)
		.attr("d", function (d) {
			var id = d.values[0].tractID.toLowerCase().replace(/\s+/g, "-");
            return afqb.plots.line(d.values, id);
		});

    // Remove old meanlines
    d3.select("#tractdetails").selectAll("svg").selectAll(".means").remove();
    if (afqb.table.splitGroups) {
        // Join new afqb.plots.tractMean data with old meanLines elements
        var meanLines = d3.select("#tractdetails").selectAll("svg")
            .selectAll(".means")
            .data(function (d) {
                return afqb.plots.tractMean.filter(function(element) {
                    return element.key === d.key;
                })[0].values;
            });

        // Enter and update. Merge entered elements and apply operations
        meanLines.enter().append("g")
            .attr("class", "tracts means")
            .attr("id", function(d) {
            	return "mean" + d.key;});

        meanLines.append("path")
            .attr("class", "area")
            .attr("d", function(d) {
                var id = this.parentNode.parentNode.id.toLowerCase().replace(/tract-/g, "");
                return afqb.plots.area(d.values, id); })
            .style("opacity", 0.25);

        meanLines.append("path")
            .attr("class", "line")
            .attr("d", function(d) {
                var id = this.parentNode.parentNode.id.toLowerCase().replace(/tract-/g, "");
                return afqb.plots.line(d.values, id); })
            .style("opacity", 0.99)
            .style("stroke-width", "3px");

        // set mean colors
        d3.select("#tractdetails").selectAll("svg").selectAll(".means").select(".area")
            .style("fill", function (d, i) { return afqb.table.ramp(i); });
        d3.select("#tractdetails").selectAll("svg").selectAll(".means").select(".line")
            .style("stroke", function (d, i) { return afqb.table.ramp(i); });
    } else {
        // Gray meanLines for unsorted 'Plot Type' change
        var meanLines = d3.select("#tractdetails").selectAll("svg")
            .append("g")
            .datum(afqb.plots.tractMean)
            .attr("class", "tracts means")
            .attr("id", "mean0");

        meanLines.append("path")
            .attr("class", "area")
            .attr("d", function(d,i) {
                var id = d[i].key.toLowerCase().replace(/\s+/g, "-");
                return afqb.plots.area(d[i].values, id); })
            .style("opacity", 0.4);

        meanLines.append("path")
            .attr("class", "line")
            .attr("d", function(d,i) {
                var id = d[i].key.toLowerCase().replace(/\s+/g, "-");
                return afqb.plots.line(d[i].values, id); })
            .style("opacity", 0.99)
            .style("stroke-width", "3px");
    }

    afqb.plots.zoomAxis();
};

afqb.plots.zoomAxis = function () {
    "use strict";
	d3.selectAll('.y.axis').call(afqb.plots.yAxis);
};

afqb.plots.newBrush = function (name) {
    "use strict";
    var brush = d3.svg.brush()
        .x(afqb.plots.xScale["left-thalamic-radiation"])
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
