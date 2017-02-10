//tractlist js

var m = {top: 20, right: 10, bottom: 10, left: 20},
w = 400 - m.left - m.right,
h = 350 - m.top - m.bottom;
var axisOffset = {bottom: 40};

// init variable to hold data later
var tractData = d3.map();
var tractMean = d3.nest();
var brushing = false;
var trPanels = null;
var lastPlotKey = null;

// transition variable for consistency
var t = d3.transition()
    .duration(750);

// Read in tract names and build tract checklist panel
var tracts;
var faPlotLength;

var nodeQ = d3_queue.queue();
nodeQ.defer(d3.csv, "data/nodes.csv");
nodeQ.await(buildFromNodes);

function buildFromNodes(error, data) {
	buildTractCheckboxes(error, data);
	buildPlotGui(error, data);
	ready(error, data);
}

function buildTractCheckboxes(error, data) {
    if (error) throw error;

	// Read only the tractID field from nodes.csv
	tracts = data.map(function(a) {return a.tractID});
	// Get only the unique entries from the tract list
	tracts = [...new Set(tracts)];

	// Also read the length of each line in the FA plots
	// Determine length by filtering on the first subject and first tractID.
	faPlotLength = data.filter(function(obj) {
		return (obj.subjectID === data[0].subjectID
			&& obj.tractID === data[0].tractID);
	}).length;

	//insert tractname checkboxes in the tractlist panel
	var svg = d3.select('#tractlist').selectAll(".input")
		.data(tracts).enter().append('div');
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
			showHideTractDetails(state, name)
			highlightBundle(state, name)
		});


	// all select/un-select all checkbox
	d3.selectAll("#selectAllTracts")
		.on("change", function () {
			var state = this.checked;
			if (state) {
				d3.selectAll(".tracts").each(function (d, i) {
					this.checked = true;
					showHideTractDetails(this.checked, this.name);
					highlightBundle(this.checked, this.name);
				});
			} else {
				d3.selectAll(".tracts").each(function (d, i) {
					this.checked = false;
					showHideTractDetails(this.checked, this.name);
					highlightBundle(this.checked, this.name);
				});
			}
		});
}

var x = d3.scale.linear()
    .range([m.left+20, w+m.left+20]);

var y = d3.scale.linear()
    .range([h - axisOffset.bottom, 0]);

//create axes
var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
	    .tickSize(0 - w - 5)
	    .ticks(5);

var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickPadding(8)
        .ticks(5);

var line = d3.svg.line()
    .interpolate("basis")
    .x(function (d) {
        if (d.nodeID) {
            return x(+d.nodeID);
        } else {
            return x(+d.key);
        }
    })
    .y(function (d) {
        if (d[plotsControlBox.plotKey]) {
            return y(+d[plotsControlBox.plotKey]);
        } else {
            return y(+d.values);
        }
    });

var bundleBrush = {};

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

var plotsControlBox = new plotsGuiConfigObj();

var plotsGuiContainer = document.getElementById('plots-gui-container');
plotsGuiContainer.appendChild(plotsGui.domElement);

function buildPlotGui(error, data) {
    if (error) throw error;

    var nodeKeys = Object.keys(data[0]).slice(3, -1)
    plotsControlBox.plotKey = nodeKeys[0]

    var keyController = plotsGui.add(plotsControlBox, 'plotKey', nodeKeys)
        .name('Plot Type')
        .onChange(function () {
            d3.csv("data/nodes.csv", updatePlots);
        });

    var plotOpacityController = plotsGui
		.add(plotsControlBox, 'lineOpacity', 0,1)
        .name('Line Opacity')
        .onChange(function () {
            d3.select("#tractdetails").selectAll("svg").selectAll(".tracts")
              .filter(function(d,i) {
                return (this.id.indexOf("mean") === -1)
              })
              .select(".line")
              .style("opacity", plotsControlBox.lineOpacity);
        });

    var brushController = plotsGui.add(plotsControlBox, 'brushTract')
        .name('Brushable Tracts')
        .onChange(updateBrush);
}
plotsGui.close();

// queue()
//     .defer(d3.csv, "data/nodes.csv")
//     .await(ready);

function ready(error, data) {
    if (error) throw error;

    data.forEach(function (d) {
      if (typeof d.subjectID === 'number'){
        d.subjectID = "s" + d.subjectID.toString();}
    });

    data = data.filter(function (d) {
		return Boolean(d[plotsControlBox.plotKey]);
	});

	lastPlotKey = plotsControlBox.plotKey;

	tractData = d3.nest()
		.key(function (d) { return d.tractID; })
		.key(function (d) { return d.subjectID; })
		.entries(data);

    // set x and y domains for the tract plots
    y.domain(d3.extent(data, function (d) {
		return +d[plotsControlBox.plotKey];
	}));
    x.domain([0, 100]).nice();

    //initialize panels for each tract - and attach tract data with them
    trPanels = d3.select("#tractdetails").selectAll("svg").data(tractData);
    trPanels.enter().append("svg")
		//d.values[0].values[0].tractID; })
        .attr("id", function (d,i) { return "tract"+ i })
        .attr("width", w + m.left + m.right + 40)
        .attr("height", h + m.top + m.bottom + axisOffset.bottom)
        .attr("display", "none")
        .append("g")
        .attr("transform", "translate(" + m.left + "," + m.top + ")")
		//y-axis
        .append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + m.left + ",0)")
        .call(yAxis);

	//x-axis
	trPanels.select("g").append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(-20," + (h - axisOffset.bottom) + ")")
        .call(xAxis);

	trPanels.append("rect")
		.attr("class", "plot")
		.attr("width", w + m.left + m.right + 20)
		.attr("height", h + m.top + m.bottom + 15)
		.attr("x", 0)
		.attr("y", 0)
		.style("stroke", function (d,i) { return d3colors[i]; })
		.style("fill", "none")
		.style("stroke-width", 2);

    /*trPanels.append("text")
       	.attr("transform", "rotate(-90)")
       	.attr("x", -h/2)
       	.attr("y",0)
       	.style("stroke", "#AFBABF")
       	.attr("dy", "1em")
       	.style("text-anchor", "middle")
       	.text("Fractional Anisotropy");*/

    trPanels.append("text")
		.attr("x", 350)
		.attr("y", h + 25)
		.attr("class", "plot_text")
		.style("text-anchor", "end")
		.style("stroke", "#888888;")
		.text("% Distance Along Fiber Bundle");

	trPanels.append("text")
		.attr("x", w + 40)
		.attr("y", h - 280)
		.attr("class", "plot_text")
		.style("text-anchor", "end")
		.style("stroke", function(d){return d3colors[d.name-1];} )
		.style("fill", function(d){return d3colors[d.name-1];} )
		.text(function(d) { return tracts[d.name-1]; });

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
        .attr("d", function (d) { return line(d.values); })
        .style("opacity", plotsControlBox.lineOpacity)
        .style("stroke-width", "1px");

    // Populate budleBrush
    d3.select("#tractdetails").selectAll("svg")[0]
        .forEach(function (d) {
            bundleBrush[d.id] = {
                brushOn: false,
                brushExtent: [0, 100]
            }
        });

    // compute mean line
    tractMean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) {
			return d3.mean(v, function (d) {
				return +d[plotsControlBox.plotKey];
			});
		})
        .entries(data);

    var meanLines = d3.select("#tractdetails").selectAll("svg")
		.append("g")
		.datum(function (d) {
			return tractMean.filter(function(element) {
				return element.key === d.key;
			})[0].values;
		})
        .attr("class", "tracts means")
        .attr("id", "mean0");

    meanLines.append("path")
        .attr("class", "line")
        .attr("d", function(d) {return line(d); })
        .style("opacity", 0.99)
        .style("stroke-width", "3.5px");

    function mouseover() {
        if (!brushing) {
            if ($("path",this).css("stroke-width") == "1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    .selectAll('path')
                    .style("opacity", 1)
                    .style("stroke-width", "1.1px");
            }
            if (isDown) {
                if ($("path",this).css("stroke-width") == "2.1px") {
					//uses the opacity of the row for selection and deselection
                    d3.selectAll('#' + this.id)
                        .selectAll('path')
                        .style("opacity", plotsControlBox.lineOpacity)
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
        if (!brushing) {
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
            } else if ($("path",this).css("opacity") == plotsControlBox.lineOpacity) {
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
        if (!brushing) {
            if ($("path",this).css("stroke-width") == "1.1px") {
				// uses the stroke-width of the line clicked on to
				// determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    .selectAll('path')
                    .style("opacity", plotsControlBox.lineOpacity)
                    .style("stroke-width", "1px");
            }
        }
    }
}

function updatePlots(error, data) {
    if (error) throw error;

	var updateAll = (lastPlotKey !== plotsControlBox.plotKey);

    data.forEach(function (d) {
      if (typeof d.subjectID === 'number'){
        d.subjectID = "s" + d.subjectID.toString();}
    });

    data = data.filter(function (d) {
		return Boolean(d[plotsControlBox.plotKey]);
	});

    if (splitGroups) {
		if (updateAll) {
			tractData = d3.nest()
				.key(function (d) { return d.tractID; })
				.key(function (d) { return d.subjectID; })
				.entries(data);
		}

        tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return subGroups[d.subjectID]; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
				return d3.mean(v, function (d) {
					return +d[plotsControlBox.plotKey];
				});
			})
			.entries(data);

		for (iTract = 0; iTract < tractMean.length; iTract++) {
			var index = tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				tractMean[iTract].values.splice(index, 1);
			}
		}
    } else {
		if (updateAll) {
			tractData = d3.nest()
				.key(function (d) { return d.tractID; })
				.key(function (d) { return d.subjectID; })
				.entries(data);
		}

        tractMean = d3.nest()
			.key(function (d) { return d.tractID; })
			.key(function (d) { return d.nodeID; })
			.rollup(function (v) {
				return d3.mean(v, function (d) {
					return +d[plotsControlBox.plotKey];
				});
			})
			.entries(data);

		for (iTract = 0; iTract < tractMean.length; iTract++) {
			var index = tractMean[iTract].values
				.findIndex(item => item.key === "null");
			if (index !== -1) {
				tractMean[iTract].values.splice(index, 1);
			}
		}
    }

	if (updateAll) {
		// update axes based on selected data
		y.domain(d3.extent(data, function (d) {
			return +d[plotsControlBox.plotKey];
		}));
		x.domain([0, 100]).nice();

		// Select the section we want to apply our changes to
		var svg = d3.select("#tractdetails").selectAll("svg")
			.data(tractData).transition();

		/*svg.select(".x.axis") // change the x axis
		  .duration(750)
		  .call(xAxis);*/
		svg.select(".y.axis") // change the y axis
			.duration(750)
			.call(yAxis);

		// JOIN new data with old elements.
		var trLines = d3.select("#tractdetails").selectAll("svg")
			.data(tractData).selectAll(".tracts")
			.data(function (d) { return d.values; }).transition();
		//.select("#path").attr("d", function (d) { return d.values; });

		trLines.select("path")
			.duration(1000)
			.attr("d", function (d) { return line(d.values); });
	}

	// Remove old meanlines
	d3.select("#tractdetails").selectAll("svg").selectAll(".means").remove();

	// Join new tractMean data with old meanLines elements
    var meanLines = d3.select("#tractdetails").selectAll("svg")
		.selectAll(".means")
		.data(function (d) {
			return tractMean.filter(function(element) {
				return element.key === d.key;
			})[0].values;
		});

	// Enter and update. Merge entered elements and apply operations
	meanLines.enter().append("g")
		.attr("class", "tracts means")
		.attr("id", function(d) {return "mean" + d.key;});

	meanLines.append("path")
		.attr("class", "line")
		.attr("d", function(d) {return line(d.values); })
		.style("opacity", 0.99)
		.style("stroke-width", "3.5px");


    // set mean colors
    if (splitGroups) {
        d3.select("#tractdetails").selectAll("svg").selectAll(".means")
            .style("stroke", function (d, i) { return ramp(i); });
    };
}

function updateBrush() {
    if (plotsControlBox.brushTract) {
		// generate brush
		var brush = d3.svg.brush()
			.x(x)
			.on("brush", brushed)
			.on("brushstart", brushStart)
			.on("brushend", brushEnd);

        var brushg = d3.select("#tractdetails").selectAll("svg")
        .append("g")
        .attr("class", "brush")
        .call(brush);

        brushg.selectAll("rect")
            .attr("y", m.top)
            .attr("height", h - axisOffset.bottom);

		function brushed() {
			bundleBrush[this.parentElement.id].brushOn = !brush.empty();
			if (brush.empty()) {
				bundleBrush[this.parentElement.id].brushExtent = [0, 100];
			} else {
				bundleBrush[this.parentElement.id].brushExtent = brush.extent();
			}
		}

		function brushStart() {
			brushing = true;
		}

		function brushEnd() {
			brushing = false;
		}
	} else {
		d3.selectAll(".brush").data([]).exit().remove();
	}
}

function showHideTractDetails(state, name)
{
  if (state==true){
    d3.select("#tract"+name).style("display", "inline");
      d3.select("#label"+name)
        .style("color",d3colors[name]);
  }
  else {
    d3.select("#tract"+name).style("display", "none");
    d3.select("#label"+name)
      .style("color","#111111");
  }

}
