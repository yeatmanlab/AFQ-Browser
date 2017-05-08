//tractlist js
afqb.plots.settings.checkboxes = {};

afqb.plots.m = {top: 20, right: 10, bottom: 10, left: 20};
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
	afqb.plots.buildTractCheckboxes(error, data);
	afqb.plots.buildPlotGui(error, data);
	afqb.plots.ready(error, data);
}

afqb.plots.buildTractCheckboxes = function (error, data) {
    if (error) throw error;

	// Read only the tractID field from nodes.csv
	afqb.plots.tracts = data.map(function(a) {return a.tractID});
	// Get only the unique entries from the tract list
	afqb.plots.tracts = [...new Set(afqb.plots.tracts)];

	// Also read the length of each line in the FA plots
	// Determine length by filtering on the first subject and first tractID.
	afqb.plots.faPlotLength = data.filter(function(obj) {
		return (obj.subjectID === data[0].subjectID
			&& obj.tractID === data[0].tractID);
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
			var state = this.checked
			var name = this.name
			//call tractdetails handler
			afqb.plots.settings.checkboxes[name] = state;
			afqb.plots.showHideTractDetails(state, name)
			afqb.three.highlightBundle(state, name)
		});


	// all select/un-select all checkbox
	d3.selectAll("#selectAllTracts")
		.on("change", function () {
			var state = this.checked;
			if (state) {
				d3.selectAll(".tracts").each(function (d, i) {
					this.checked = true;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);
				});
			} else {
				d3.selectAll(".tracts").each(function (d, i) {
					this.checked = false;
					afqb.plots.settings.checkboxes[this.name] = this.checked;
					afqb.plots.showHideTractDetails(this.checked, this.name);
					afqb.three.highlightBundle(this.checked, this.name);
				});
			}
		});
};

afqb.plots.x = d3.scale.linear()
    .range([afqb.plots.m.left + 20, afqb.plots.w + afqb.plots.m.left + 20]);

afqb.plots.y = d3.scale.linear()
    .range([afqb.plots.h - afqb.plots.axisOffset.bottom, 0]);

//create axes
afqb.plots.yAxis = d3.svg.axis()
        .scale(afqb.plots.y)
        .orient("left")
	    .tickSize(0 - afqb.plots.w - 5)
	    .ticks(5);

afqb.plots.xAxis = d3.svg.axis()
        .scale(afqb.plots.x)
        .orient("bottom")
        .tickPadding(8)
        .ticks(5);

afqb.plots.zoomable = true;
afqb.plots.yzoom = d3.behavior.zoom()
				.y(afqb.plots.y)
				.on("zoom", afqb.plots.zoomable?zoomAxis:null)
				.on("zoomend",afqb.plots.zoomable?draw:null);

afqb.plots.line = d3.svg.line()
    .interpolate("basis")
    .x(function (d) {
        if (d.nodeID) {
            return afqb.plots.x(+d.nodeID);
        } else {
            return afqb.plots.x(+d.key);
        }
    })
    .y(function (d) {
        if (d[afqb.global.controls.plotsControlBox.plotKey]) {
            return afqb.plots.y(+d[afqb.global.controls.plotsControlBox.plotKey]);
        } else {
            return afqb.plots.y(+d.values);
        }
    });

afqb.plots.bundleBrush = {};

afqb.plots.buildPlotGui = function (error, data) {
    if (error) throw error;

	var plotsGuiConfigObj = function () {
		this.brushTract = false;
		this.plotKey = null;
		this.lineOpacity = 0.3;
	};

	var plotsGui = new dat.GUI({
		autoplace: false,
		width: 250,
		scrollable: false
	});

	var plotsGuiContainer = document.getElementById('plots-gui-container');
	plotsGuiContainer.appendChild(plotsGui.domElement);

	afqb.global.controls.plotsControlBox = new plotsGuiConfigObj();

    var nodeKeys = Object.keys(data[0]).slice(3);
    afqb.global.controls.plotsControlBox.plotKey = nodeKeys[0];

    var keyController = plotsGui
		.add(afqb.global.controls.plotsControlBox, 'plotKey', nodeKeys)
        .name('Plot Type')
        .onChange(function () {
            d3.csv("data/nodes.csv", afqb.plots.updatePlots);
        });

    var plotOpacityController = plotsGui
		.add(afqb.global.controls.plotsControlBox, 'lineOpacity', 0,1)
        .name('Line Opacity')
        .onChange(function () {
			d3.select("#tractdetails")
				.selectAll("svg").selectAll(".tracts")
				.filter(function(d,i) {
					return (this.id.indexOf("mean") === -1)
				  })
				  .select(".line")
				  .style("opacity", afqb.global.controls.plotsControlBox.lineOpacity);
        });

    var brushController = plotsGui
		.add(afqb.global.controls.plotsControlBox, 'brushTract')
        .name('Brushable Tracts')
        .onChange(afqb.plots.updateBrush);

	plotsGui.close();
};

afqb.plots.ready = function (error, data) {
    if (error) throw error;

    data.forEach(function (d) {
      if (typeof d.subjectID === 'number'){
        d.subjectID = "s" + d.subjectID.toString();}
    });

    data = data.filter(function (d) {
		return Boolean(d[afqb.global.controls.plotsControlBox.plotKey]);
	});

	afqb.plots.lastPlotKey = afqb.global.controls.plotsControlBox.plotKey;

	afqb.plots.tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

    // set x and y domains for the tract plots
    afqb.plots.y.domain(d3.extent(data, function (d) {
		return +d[afqb.global.controls.plotsControlBox.plotKey];
	}));
    afqb.plots.x.domain([0, 100]).nice();

    //initialize panels for each tract - and attach tract data with them
    var trPanels = d3.select("#tractdetails").selectAll("svg").data(afqb.plots.tractData);
    trPanels.enter().append("svg")
        .attr("id", function (d,i) { return "tract"+ i })
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

		trPanels.append("svg:rect")
        .attr("class", "zoom y box")
        .attr("width", afqb.plots.m.left+20)
        .attr("height", afqb.plots.h - afqb.plots.m.top - afqb.plots.m.bottom)
        //.attr("transform", "translate(" + afqb.plots.m.left + ",0)")
        .style("visibility", "hidden")
        .attr("pointer-events", "all")
        .call(afqb.plots.yzoom);

	//x-axis
	trPanels.select("g").append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(-20," + (afqb.plots.h - afqb.plots.axisOffset.bottom) + ")")
        .call(afqb.plots.xAxis);

	trPanels.append("rect")
		.attr("class", "plot")
		.attr("width", afqb.plots.w + afqb.plots.m.left + afqb.plots.m.right + 20)
		.attr("height", afqb.plots.h + afqb.plots.m.top + afqb.plots.m.bottom + 15)
		.attr("x", 0)
		.attr("y", 0)
		.style("stroke", function (d,i) { return afqb.global.d3colors[i]; })
		.style("fill", "none")
		.style("stroke-width", 2);

    trPanels.append("text")
		.attr("x", 350)
		.attr("y", afqb.plots.h + 25)
		.attr("class", "plot_text")
		.style("text-anchor", "end")
		.style("stroke", "#888888;")
		.text("% Distance Along Fiber Bundle");

	trPanels.append("text")
		.attr("x", afqb.plots.w + 40)
		.attr("y", afqb.plots.h - 280)
		.attr("class", "plot_text")
		.style("text-anchor", "end")
		.style("stroke", function(d){return afqb.global.d3colors[d.name-1];} )
		.style("fill", function(d){return afqb.global.d3colors[d.name-1];} )
		.text(function(d) { return afqb.plots.tracts[d.name-1]; });

	// associate tractsline with each subject
    var tractLines = trPanels.selectAll(".tracts")
        .data(function(d){ return d.values; })
        .enter().append("g")
        .attr("class", "tracts")
        .attr("id", function (d, i) {
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
            afqb.plots.bundleBrush[d.id] = {
                brushOn: false,
                brushExtent: [0, 100]
            }
        });

    // compute mean line
    afqb.plots.tractMean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) {
			return d3.mean(v, function (d) {
				return +d[afqb.global.controls.plotsControlBox.plotKey];
			});
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
        .attr("class", "line")
        .attr("d", function(d) {return afqb.plots.line(d); })
        .style("opacity", 0.99)
        .style("stroke-width", "3.5px");

    function mouseover() {
        if (!afqb.global.mouse.brushing) {
            if ($("path",this).css("stroke-width") == "1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    .selectAll('path')
                    .style("opacity", 1)
                    .style("stroke-width", "1.1px");
            }
            if (afqb.global.mouse.isDown) {
                if ($("path",this).css("stroke-width") == "2.1px") {
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
            if ($("path",this).css("stroke-width") == "2.1px") {
				// uses the stroke-width of the line clicked on
				// to determine whether to turn the line on or off
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("stroke-width", "1.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 0.3);

            } else if ($("path",this).css("stroke-width") == "1.1px") {
				d3.selectAll('#' + this.id)
					.selectAll('path')
					.style("opacity", 1)
					.style("stroke-width", "2.1px");

				d3.selectAll('#' + this.id)
					.selectAll('g')
					.style("opacity", 1);
            } else if ($("path",this).css("opacity") == afqb.global.controls.plotsControlBox.lineOpacity) {
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
            if ($("path",this).css("stroke-width") == "1.1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    .selectAll('path')
                    .style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
                    .style("stroke-width", "1px");
            }
        }
    }
}

afqb.plots.updatePlots = function (error, data) {
    if (error) throw error;

	var updateAll = (afqb.plots.lastPlotKey !== afqb.global.controls.plotsControlBox.plotKey);
	afqb.plots.lastPlotKey = afqb.global.controls.plotsControlBox.plotKey;

    data.forEach(function (d) {
      if (typeof d.subjectID === 'number'){
        d.subjectID = "s" + d.subjectID.toString();}
    });

    data = data.filter(function (d) {
		return Boolean(d[afqb.global.controls.plotsControlBox.plotKey]);
	});

    if (afqb.table.splitGroups) {
		if (updateAll) {
			afqb.plots.tractData = d3.nest()
				.key(function (d) { return d.tractID; })
				.key(function (d) { return d.subjectID; })
				.entries(data);
		}

        afqb.plots.tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return afqb.table.subGroups[d.subjectID]; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
				return d3.mean(v, function (d) {
					return +d[afqb.global.controls.plotsControlBox.plotKey];
				});
			})
			.entries(data);

		for (iTract = 0; iTract < afqb.plots.tractMean.length; iTract++) {
			var index = afqb.plots.tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				afqb.plots.tractMean[iTract].values.splice(index, 1);
			}
		}
    } else {
		if (updateAll) {
			afqb.plots.tractData = d3.nest()
				.key(function (d) { return d.tractID; })
				.key(function (d) { return d.subjectID; })
				.entries(data);
		}

        afqb.plots.tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
				return d3.mean(v, function (d) {
					return +d[afqb.global.controls.plotsControlBox.plotKey];
				});
			})
			.entries(data);

		for (iTract = 0; iTract < afqb.plots.tractMean.length; iTract++) {
			var index = afqb.plots.tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				afqb.plots.tractMean[iTract].values.splice(index, 1);
			}
		}
    }

		if (updateAll) {
			// update axes based on selected data
			afqb.plots.y.domain(d3.extent(data, function (d) {
				return +d[afqb.global.controls.plotsControlBox.plotKey];
			}));
			afqb.plots.x.domain([0, 100]).nice();

			// Select the section we want to apply our changes to
			var svg = d3.select("#tractdetails").selectAll("svg")
				.data(afqb.plots.tractData).transition();

			svg.select(".y.axis") // change the y axis
				.duration(750)
				.call(afqb.plots.yAxis);

			// update y zoom for new axis
			afqb.plots.yzoom = d3.behavior.zoom()
														 .y(afqb.plots.y)
														 .on("zoom", afqb.plots.zoomable?zoomAxis:null)
														 .on("zoomend",afqb.plots.zoomable?draw:null);
			d3.select("#tractdetails").selectAll("svg").selectAll(".zoom.y.box").call(afqb.plots.yzoom);//.remove();


			// JOIN new data with old elements.
			var trLines = d3.select("#tractdetails").selectAll("svg")
				.data(afqb.plots.tractData).selectAll(".tracts")
				.data(function (d) { return d.values; }).transition();
			//.select("#path").attr("d", function (d) { return d.values; });

			trLines.select("path")
				.duration(0)
				.attr("d", function (d) { return afqb.plots.line(d.values); });
		}

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
				.attr("class", "line")
				.attr("d", function(d) {return afqb.plots.line(d.values); })
				.style("opacity", 0.99)
				.style("stroke-width", "3.5px");
	    // set mean colors
	    d3.select("#tractdetails").selectAll("svg").selectAll(".means")
	      .style("stroke", function (d, i) { return afqb.table.ramp(i); });
	  } else{
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
				.attr("class", "line")
				.attr("d", function(d) {return afqb.plots.line(d); })
				.style("opacity", 0.99)
				.style("stroke-width", "3.5px");
			}

}
function zoomAxis(){
	d3.selectAll('g.y.axis').call(afqb.plots.yAxis);
}
function draw() {

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
		.attr("class", "line")
		.attr("d", function(d) {return afqb.plots.line(d.values); })
		.style("opacity", 0.99)
		.style("stroke-width", "3.5px");
	// set mean colors
	d3.select("#tractdetails").selectAll("svg").selectAll(".means")
		.style("stroke", function (d, i) { return afqb.table.ramp(i); });
} else{
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
		.attr("class", "line")
		.attr("d", function(d) {return afqb.plots.line(d); })
		.style("opacity", 0.99)
		.style("stroke-width", "3.5px");
	}
};

afqb.plots.updateBrush = function () {
    if (afqb.global.controls.plotsControlBox.brushTract) {
		// generate brush
		var brush = d3.svg.brush()
			.x(afqb.plots.x)
			.on("brush", brushed)
			.on("brushstart", brushStart)
			.on("brushend", brushEnd);

        var brushg = d3.select("#tractdetails").selectAll("svg")
        .append("g")
        .attr("class", "brush")
        .call(brush);

        brushg.selectAll("rect")
            .attr("y", afqb.plots.m.top)
            .attr("height", afqb.plots.h - afqb.plots.axisOffset.bottom);

		function brushed() {
			afqb.plots.bundleBrush[this.parentElement.id].brushOn = !brush.empty();
			if (brush.empty()) {
				afqb.plots.bundleBrush[this.parentElement.id].brushExtent = [0, 100];
			} else {
				afqb.plots.bundleBrush[this.parentElement.id].brushExtent = brush.extent();
			}
		}

		function brushStart() {
			afqb.global.mouse.brushing = true;
		}

		function brushEnd() {
			afqb.global.mouse.brushing = false;
		}
	} else {
		d3.selectAll(".brush").data([]).exit().remove();
		for (bundle in afqb.plots.bundleBrush) {
			if (afqb.plots.bundleBrush.hasOwnProperty(bundle)) {
				afqb.plots.bundleBrush[bundle].brushExtent = [0, 100];
			}
		}
	}
};

afqb.plots.showHideTractDetails = function (state, name) {
  if (state==true){
    d3.select("#tract"+name).style("display", "inline");
      d3.select("#label"+name)
        .style("color",afqb.global.d3colors[name]);
  }
  else {
    d3.select("#tract"+name).style("display", "none");
    d3.select("#label"+name)
      .style("color","#111111");
  }

};

afqb.global.queues.nodeQ = d3_queue.queue();
afqb.global.queues.nodeQ.defer(d3.csv, "data/nodes.csv");
afqb.global.queues.nodeQ.await(afqb.plots.buildFromNodes);
