// Tell jslint that certain variables are global
/* global afqb, d3, d3_queue, dat, $ */
/* eslint experimentalObjectRestSpread: true */

//tractlist js
afqb.plots.settings.checkboxes = {};
afqb.plots.settings.zoom = {};
afqb.plots.yzooms = {};
afqb.plots.zoomable = true;

afqb.plots.m = {top: 20, right: 10, bottom: 10, left: 25};
afqb.plots.w = 400 - afqb.plots.m.left - afqb.plots.m.right,
afqb.plots.h = 350 - afqb.plots.m.top - afqb.plots.m.bottom;
afqb.plots.axisOffset = {bottom: 40};

// init variable to hold data later
afqb.plots.tractData = d3.map();
afqb.plots.tractMean = d3.nest();
afqb.global.mouse.brushing = false;
afqb.plots.lastPlotKey = null;

// transition variable for consistency
afqb.plots.t = d3.transition().duration(750);

afqb.plots.buildFromNodes = function (error, data) {
	"use strict";
    afqb.plots.buildTractCheckboxes(error, data);
	afqb.plots.buildPlotGui(error, data);
	afqb.plots.ready(error, data);
};

afqb.plots.brushes = [];

afqb.plots.buildTractCheckboxes = function (error, data) {
	"use strict";
    if (error) { throw error; }

	// Read only the tractID field from nodes.csv
	afqb.plots.tracts = data.map(function (a) { return a.tractID; });
	// Get only the unique entries from the tract list
	afqb.plots.tracts = [...new Set(afqb.plots.tracts)];

	// Also read the length of each line in the FA plots
	// Determine length by filtering on the first subject and first tractID.
	afqb.plots.faPlotLength = data.filter(function(obj) {
		return (obj.subjectID === data[0].subjectID && obj.tractID === data[0].tractID);
	}).length;

	//insert tractname checkboxes in the tractlist panel
	var svg = d3.select('#tractlist').selectAll(".input")
		.data(afqb.plots.tracts).enter().append('div');
	svg.append('input')
		.attr("type", "checkbox")
		.attr("class", "tracts")
		.attr("id", function (d, i) { return "input" + (i + 1); })
		.attr("name", function (d, i) { return i; });
	// add label to the checkboxes
	svg.append('label')
		.text(function (d) { return d; })
		.attr("for", function (d, i) { return "input" + (i + 1); })
		.attr("id", function (d, i) { return "label" + i; });

	//add event handler to the checkbox
	d3.selectAll(".tracts")
		.on("change", function () {
			var state = this.checked;
			var name = this.name;
			//call tractdetails handler
			afqb.plots.settings.checkboxes[name] = state;
			afqb.plots.showHideTractDetails(state, name);
			afqb.three.highlightBundle(state, name);
		});


	// all select/un-select all checkbox
	d3.selectAll("#selectAllTracts")
		.on("change", function () {
			var state = this.checked;
			if (state) {
				d3.selectAll(".tracts").each(function () {
					this.checked = true;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);
				});
			} else {
				d3.selectAll(".tracts").each(function () {
					this.checked = false;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);
				});
			}
		});
};

afqb.plots.xScale = d3.scale.linear()
	.range([afqb.plots.m.left + 25, afqb.plots.w + afqb.plots.m.left + 20]);

afqb.plots.yScale = d3.scale.linear()
	.range([afqb.plots.h - afqb.plots.axisOffset.bottom, 0]);

//create axes
afqb.plots.yAxis = d3.svg.axis()
	.scale(afqb.plots.yScale)
	.orient("left")
	.tickSize(0 - afqb.plots.w - 5)
	.ticks(5);

afqb.plots.xAxis = d3.svg.axis()
	.scale(afqb.plots.xScale)
	.orient("bottom")
	.tickPadding(8)
	.ticks(5);

afqb.plots.line = d3.svg.line()
    .interpolate("basis")
    .x(function (d) {
        if (d.nodeID) {
            return afqb.plots.xScale(+d.nodeID);
        } else {
            return afqb.plots.xScale(+d.key);
        }
    })
    .y(function (d) {
        if (d[afqb.global.controls.plotsControlBox.plotKey]) {
            return afqb.plots.yScale(+d[afqb.global.controls.plotsControlBox.plotKey]);
        } else {
            return afqb.plots.yScale(+d.values.mean);
        }
    });

       
afqb.plots.area = d3.svg.area()
    .x(function(d) { return afqb.plots.x(+d.key) })
    .y0(function (d) {
        if (afqb.global.controls.plotsControlBox.errorType == 'stderr') {
            return afqb.plots.yScale(+d.values.mean - +d.values.stderr);
        } else {
            return afqb.plots.yScale(+d.values.mean - +d.values.std);
        }
    })
    .y1(function (d) {
		if (afqb.global.controls.plotsControlBox.errorType == 'stderr') {
            return afqb.plots.yScale(+d.values.mean + +d.values.stderr);
        } else {
			return afqb.plots.yScale(+d.values.mean + +d.values.std);
		}
	});

afqb.plots.settings.bundleBrush = {};

afqb.plots.buildPlotGui = function (error, data) {
    "use strict";
	if (error) { throw error; }

    afqb.plots.settings.brushTract = false;
    afqb.plots.settings.plotKey = null;
    afqb.plots.settings.lineOpacity = 0.3;
    afqb.plots.settings.errorType = 'std';

	var plotsGuiConfigObj = function () {
		this.plotKey = afqb.plots.settings.plotKey;
        this.errorType = 'std';
		this.lineOpacity = afqb.plots.settings.lineOpacity;
        this.brushTract = afqb.plots.settings.brushTract;
	};

	afqb.plots.gui = new dat.GUI({
		autoplace: false,
		width: 250,
		scrollable: false
	});

	var plotsGuiContainer = document.getElementById('plots-gui-container');
	plotsGuiContainer.appendChild(afqb.plots.gui.domElement);

	afqb.global.controls.plotsControlBox = new plotsGuiConfigObj();

    var nodeKeys = Object.keys(data[0]).slice(3);
    afqb.global.controls.plotsControlBox.plotKey = nodeKeys[0];

    // Add key controller
	afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'plotKey', nodeKeys)
        .name('Plot Type')
        .onChange(function () {
            d3.csv("data/nodes.csv", afqb.plots.changePlots);
            // update y label
            d3.selectAll(".y.label").remove();

            d3.select("#tractdetails").selectAll("svg").append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "translate("+ (afqb.plots.m.left/2+5) +","+
                      ((afqb.plots.h+afqb.plots.m.top)/2)+")rotate(-90)")
                .attr("class", "y label")
                .style("stroke", "#888888;")
                .text(function (d,i) { return afqb.global.controls.plotsControlBox.plotKey});
            
            setTimeout(afqb.plots.zoomAxis, 1000);
        });

    // Add error controller
    afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'errorType', ['stderr', 'std'])
        .name('Error Type')
		    .onChange(function () {
		        d3.csv("data/nodes.csv", afqb.plots.changePlots);
        });

    // Add plot opacity controller
    afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'lineOpacity', 0,1)
        .name('Line Opacity')
        .onChange(function () {
			d3.select("#tractdetails")
				.selectAll("svg").selectAll(".tracts")
				.filter(function () {
					return (this.id.indexOf("mean") === -1);
                })
				.select(".line")
				.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity);
		});

    // Add brush controller
	afqb.plots.gui
		.add(afqb.global.controls.plotsControlBox, 'brushTract')
		.name('Brushable Tracts')
		.onChange(afqb.plots.updateBrush);

	afqb.plots.gui.close();
};

afqb.plots.ready = function (error, data) {
    "use strict";
	if (error) { throw error; }

	data.forEach(function (d) {
		if (typeof d.subjectID === 'number') {
			d.subjectID = "s" + d.subjectID.toString();
        }
	});

	var plotKey = afqb.global.controls.plotsControlBox.plotKey;
	afqb.plots.settings.zoom[plotKey] = {};

	data = data.filter(function (d) {
		return Boolean(d[plotKey]);
	});
    
    afqb.plots.yzooms[plotKey] = d3.behavior.zoom()
        .y(afqb.plots.yScale)
        .on("zoom", afqb.plots.zoomable ? afqb.plots.zoomAxis : null)
        .on("zoomend",afqb.plots.zoomable ? afqb.plots.draw : null);

	afqb.plots.lastPlotKey = plotKey;

	afqb.plots.tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

	// set x and y domains for the tract plots
	afqb.plots.yScale.domain(d3.extent(data, function (d) {
		return +d[plotKey];
	}));
	afqb.plots.xScale.domain([0, 100]).nice();
    
    afqb.plots.yAxis.scale(afqb.plots.yScale);

	//initialize panels for each tract - and attach tract data with them
	var trPanels = d3.select("#tractdetails").selectAll("svg").data(afqb.plots.tractData);
	trPanels.enter().append("svg")
		.attr("id", function (d,i) { return "tract" + i; })
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
	trPanels.select("g").append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(-20," + (afqb.plots.h - afqb.plots.axisOffset.bottom) + ")")
		.call(afqb.plots.xAxis);

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

	// associate tractsline with each subject
	var tractLines = trPanels.selectAll(".tracts")
		.data(function(d){ return d.values; })
		.enter().append("g")
		.attr("class", "tracts")
		.attr("id", function (d) {
				return d.values[0].subjectID;
		})
		.on("mouseover", mouseover)
		.on("mouseout", mouseout)
		.on("click", onclick);

	tractLines.append("path")
		.attr("class", "line")
		.attr("d", function (d) { return afqb.plots.line(d.values); })
		.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
		.style("stroke-width", "1px");

	// Populate budleBrush
	d3.select("#tractdetails").selectAll("svg")[0]
		.forEach(function (d) {
			afqb.plots.settings.bundleBrush[d.id] = {
				brushOn: false,
				brushExtent: [0, 100]
			};
		});

    // compute mean line
    afqb.plots.tractMean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) {
            return {
                mean: d3.mean(v, function (d) {
                        return +d[plotKey];}),
                stderr: d3.deviation(v, function (d) {
                        return +d[plotKey];
                })/Math.sqrt(v.length),
                std: d3.deviation(v, function (d) {
                        return +d[plotKey];
                })
            };
        })
        .entries(data);

	var meanLines = d3.select("#tractdetails").selectAll("svg")
		.append("g")
		.datum(function (d) {
			return afqb.plots.tractMean.filter(function(element) {
				return element.key === d.key;
			})[0].values;
		})
		.attr("class", "tracts means")
		.attr("id", "mean0");

    meanLines.append("path")
        .attr("class", "area")
        .attr("d", function(d) { return afqb.plots.area(d); })
        .style("opacity", 0.4);

    meanLines.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return afqb.plots.line(d); })
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
};

afqb.plots.changePlots = function (error, data) {
    "use strict";
	if (error) { throw error; }

	var plotKey = afqb.global.controls.plotsControlBox.plotKey;

	afqb.plots.lastPlotKey = plotKey;

	data.forEach(function (d) {
		if (typeof d.subjectID === 'number'){
			d.subjectID = "s" + d.subjectID.toString();
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
					stderr: d3.deviation(v, function (d,i) {
                        return +d[plotKey];})/Math.sqrt(v.length),
					std: d3.deviation(v, function (d) {
                        return +d[plotKey];
                    })
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
                    stderr: d3.deviation(v, function (d) {
 						 return +d[plotKey];
                    })/Math.sqrt(v.length),
                    std: d3.deviation(v, function (d) {
 						 return +d[plotKey];
                    })
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
	afqb.plots.xScale.domain([0, 100]).nice();
    
    afqb.plots.yAxis.scale(afqb.plots.yScale);

	// Select the section we want to apply our changes to
	var svg = d3.select("#tractdetails").selectAll("svg")
		.data(afqb.plots.tractData).transition();

	svg.selectAll(".y.axis") // change the y axis
		.call(afqb.plots.yAxis);

	// update y zoom for new axis
	afqb.plots.yzooms[plotKey] = d3.behavior.zoom()
		.y(afqb.plots.yScale)
		.on("zoom", afqb.plots.zoomable ? afqb.plots.zoomAxis : null)
		.on("zoomend", afqb.plots.zoomable ? afqb.plots.draw : null);

	// If we've already stored this type of plot's zoom settings, recover them
	if (afqb.plots.settings.zoom[plotKey]) {
		afqb.plots.yzooms[plotKey].scale(
				afqb.plots.settings.zoom[plotKey].scale || 1);
		afqb.plots.yzooms[plotKey].translate(
				afqb.plots.settings.zoom[plotKey].translate || [0, 0]);
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

	// JOIN new data with old elements.
	var trLines = d3.select("#tractdetails").selectAll("svg")
		.data(afqb.plots.tractData).selectAll(".tracts")
		.data(function (d) { return d.values; }).transition();
		//.select("#path").attr("d", function (d) { return d.values; });

	trLines.select("path")
		.duration(0)
		.attr("d", function (d) { return afqb.plots.line(d.values); });

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
            .attr("id", function(d) {return "mean" + d.key;});

        meanLines.append("path")
            .attr("class", "area")
            .attr("d", function(d) {return afqb.plots.area(d.values); })
            .style("opacity", 0.25);

        meanLines.append("path")
            .attr("class", "line")
            .attr("d", function(d) {return afqb.plots.line(d.values); })
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
            .datum(function (d) {
                return afqb.plots.tractMean.filter(function(element) {
                    return element.key === d.key;
                })[0].values;
            })
            .attr("class", "tracts means")
            .attr("id", "mean0");

        meanLines.append("path")
            .attr("class", "area")
            .attr("d", function(d) {return afqb.plots.area(d); })
            .style("opacity", 0.25);

        meanLines.append("path")
            .attr("class", "line")
            .attr("d", function(d) {return afqb.plots.line(d); })
            .style("opacity", 0.99)
            .style("stroke-width", "3px");
    }
    
    afqb.plots.zoomAxis();
};

afqb.plots.zoomAxis = function () {
    "use strict";
	d3.selectAll('.y.axis').call(afqb.plots.yAxis);
};

afqb.plots.newBrush = function (id) {
    "use strict";
    var brush = d3.svg.brush()
        .x(afqb.plots.xScale)
        .on("brush", brushed)
		.on("brushstart", brushStart)
		.on("brushend", brushEnd);
    
    function brushed() {
        var targetId = this.parentElement.id;
        var targetBrush = afqb.plots.brushes.filter(function (b) {
            return b.id === targetId;
        })[0].brush;
		afqb.plots.settings.bundleBrush[targetId].brushOn = !targetBrush.empty();
		if (targetBrush.empty()) {
			afqb.plots.settings.bundleBrush[targetId].brushExtent = [0, 100];
		} else {
		    afqb.plots.settings.bundleBrush[targetId].brushExtent = targetBrush.extent();
		}
	}

	function brushStart() {
		afqb.global.mouse.brushing = true;
	}

	function brushEnd() {
		afqb.global.mouse.brushing = false;
	}
    
    afqb.plots.brushes.push({id: id, brush: brush});
};

afqb.plots.updateBrush = function () {
    "use strict";
    d3.select("#tractdetails").selectAll("svg")[0].forEach(function (tract) {
        afqb.plots.newBrush(tract.id);
    });

	if (afqb.global.controls.plotsControlBox.brushTract) {
        var callBrush = function () {
            var targetId = this.parentElement.id;
            var targetBrush = afqb.plots.brushes.filter(function (b) {
                return b.id === targetId;
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
        Object.keys(afqb.plots.settings.bundleBrush).forEach(function (bundle) {
            afqb.plots.settings.bundleBrush[bundle].brushExtent = [0, 100];
        });
	}
};

afqb.plots.showHideTractDetails = function (state, name) {
    "use strict";
	if (state === true){
		d3.select("#tract"+name).style("display", "inline");
		d3.select("#label"+name)
			.style("color",afqb.global.d3colors[name]);
	} else {
		d3.select("#tract"+name).style("display", "none");
		d3.select("#label"+name)
			.style("color","#111111");
	}
};

afqb.global.queues.nodeQ = d3_queue.queue();
afqb.global.queues.nodeQ.defer(d3.csv, "data/nodes.csv");
afqb.global.queues.nodeQ.await(afqb.plots.buildFromNodes);
