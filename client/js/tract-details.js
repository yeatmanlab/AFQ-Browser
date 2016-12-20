//tractlist js

var m = {top: 20, right: 10, bottom: 10, left: 20},
w = 400 - m.left - m.right,
h = 350 - m.top - m.bottom;
var axisOffset = {bottom: 40};

// init variable to hold data later
var tractdata = d3.map();
var brushing = false;
var trpanels = null;

// transition variable for consistency
var t = d3.transition()
    .duration(750);

// Read in tract names and build tract checklist panel
var tracts;
var faPlotLength;

queue()
    .defer(d3.csv, "data/nodes.csv")
    .await(buildTractCheckboxes);

function buildTractCheckboxes(error, data) {
    if (error) throw error;

	// Read only the tractID field from nodes.csv
	tracts = data.map(function(a) {return a.tractID});
	// Get only the unique entries from the tract list
	tracts = [...new Set(tracts)];

	// Also read the length of each line in the FA plots
	// Determine length by filtering on the first subject and first tractID.
	faPlotLength = data.filter(function(obj) {
		return (obj.subjectID === data[0].subjectID && obj.tractID === data[0].tractID);
	}).length;

	//insert tractname checkboxes in the tractlist panel
	var svg = d3.select('#tractlist').selectAll(".input").data(tracts).enter().append('div');
	svg.append('input')
		.attr("type", "checkbox")
		.attr("class", "tracts")
		.attr("id", function (d, i) { return "input" + (i + 1); })
		.attr("name", function (d, i) { return i; })
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
};

var plotsGui = new dat.GUI({
    autoplace: false,
    width: 250,
    scrollable: false
});

var plotsControlBox = new plotsGuiConfigObj();

var plotsGuiContainer = document.getElementById('plots-gui-container');
plotsGuiContainer.appendChild(plotsGui.domElement);

queue()
    .defer(d3.csv, "data/nodes.csv")
    .await(buildPlotGui);

function buildPlotGui(error, data) {
    if (error) throw error;

    var nodeKeys = Object.keys(data[0]).slice(3, -1)
    plotsControlBox.plotKey = nodeKeys[0]

    var keyController = plotsGui.add(plotsControlBox, 'plotKey', nodeKeys)
        .name('Plot Type')
        .onChange(function () {
            d3.csv("data/nodes.csv", updatePlots);
        });

    var brushController = plotsGui.add(plotsControlBox, 'brushTract')
        .name('Brushable Tracts')
        .onChange(function () {
            d3.selectAll(".brush").data([]).exit().remove();

            d3.csv("data/nodes.csv", updatePlots);
        });
}
plotsGui.close();

// FIGURE OUT QUEUE TO MAKE SURE METADATA TABLE LOADS FIRST
queue()
    .defer(d3.csv, "data/nodes.csv")
    .await(ready);

function ready(error, data) {
    if (error) throw error;

    var tractdata = d3.nest()
     .key(function (d) { return d.tractID; })
     .key(function (d) { return d.subjectID; })
     .entries(data);

    var tract_mean = d3.nest()
      .key(function (d) { return d.tractID; })
      .key(function (d) { return d.nodeID; })
      .rollup(function (v) { return d3.mean(v, function (d) { return +d[plotsControlBox.plotKey]; }); })
      .entries(data);

    for (i = 0; i < tract_mean.length; i++) {
        tractdata[i].values.push(tract_mean[i]);
    }

    // set x and y domains for the tract plots
    y.domain(d3.extent(data, function (d) { return +d[plotsControlBox.plotKey]; }));
    x.domain([0, 100]).nice();

    //initialize panels for each tract - and attach tract data with them
    trpanels = d3.select("#tractdetails").selectAll("svg").data(tractdata);
    trpanels.enter().append("svg")
        .attr("id", function (d,i) { return "tract"+ i}) //d.values[0].values[0].tractID; })
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
   trpanels.select("g").append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(-20," + (h - axisOffset.bottom) + ")")
        .call(xAxis);

    trpanels.append("rect")
           .attr("class", "plot")
           .attr("width", w + m.left + m.right + 20)
           .attr("height", h + m.top + m.bottom + 15)
                 .attr("x", 0)
                 .attr("y", 0)
                .style("stroke", function (d,i) { return d3colors[i]; })
                .style("fill", "none")
                .style("stroke-width", 2);

    /*trpanels.append("text")
       	.attr("transform", "rotate(-90)")
       	.attr("x", -h/2)
       	.attr("y",0)
       	.style("stroke", "#AFBABF")
       	.attr("dy", "1em")
       	.style("text-anchor", "middle")
       	.text("Fractional Anisotropy");*/

    trpanels.append("text")
        	.attr("x", 350)
        	.attr("y", h + 25)
            .attr("class", "plot_text")
        	.style("text-anchor", "end")
        	.style("stroke", "#888888;")
        	.text("% Distance Along Fiber Bundle");

       trpanels.append("text")
             .attr("x", w + 40)
             .attr("y", h - 280)
             .attr("class", "plot_text")
             .style("text-anchor", "end")
             .style("stroke", function(d){return d3colors[d.name-1];} )
             .style("fill", function(d){return d3colors[d.name-1];} )
             .text(function(d) { return tracts[d.name-1]; });

// associate tractsline with each subject
    var  tractlines = trpanels.selectAll(".tracts")
        .data(function(d){ return d.values; })
        .enter().append("g")
        .attr("class", "tracts")
        .attr("id", function (d, i) {
            if (i >= sub_data.length) {
                return "Mean";
            } else {
                return d.values[0].subjectID;
            }
        })
        .style("opacity", 0.3)
        .style("stroke-width", "1px")
        .on("mouseover", mouseover)
        .on("mouseout", mouseout)
        .on("click", onclick);

    d3.selectAll("#Mean")
        .style("opacity", 0.99)
        .style("stroke-width", "3.5px")

    tractlines.append("path")
        .attr("class", "line")
        .attr("d", function (d) { return line(d.values); });

    // Populate budleBrush
    d3.select("#tractdetails").selectAll("svg")[0]
        .forEach(function (d) {
            bundleBrush[d.id] = {
                brushOn: false,
                brushExtent: [0, 100]
            }
        });

    function mouseover() {
        if (!brushing) {
            if ($(this).css("stroke-width") == "1px") {			//uses the stroke-width of the line clicked on to determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    //.transition()
                    //.duration(50)
                    .style("opacity", 1)
                    .style("stroke-width", "1.1px");
            }
            if (isDown) {
                if ($(this).css("stroke-width") == "2.1px") {				  //uses the opacity of the row for selection and deselection
                    d3.selectAll('#' + this.id)
                        //.transition()
                        //.duration(50)
                        .style("opacity", 0.3)
                        .style("stroke-width", "1px");
                } else if ($(this).css("stroke-width") == "1.1px") {
                    d3.selectAll('#' + this.id)
                        //.transition()
                        //.duration(50)
                        .style("opacity", 1)
                        .style("stroke-width", "2.1px");
                } else if ($(this).css("stroke-width") == "1px") {
                    d3.selectAll('#' + this.id)
                        //.transition()
                        //.duration(50)
                        .style("opacity", 1)
                        .style("stroke-width", "2.1px");
                }
            }
        }
    }

    function onclick() {
        if (!brushing) {
            if ($(this).css("stroke-width") == "2.1px") {				//uses the stroke-width of the line clicked on to determine whether to turn the line on or off

                d3.selectAll('#' + this.id)
                    //.transition()
                    //.duration(50)
                    .style("opacity", 0.3)
                    .style("stroke-width", "1px");
            } else if ($(this).css("stroke-width") == "1.1px") {
                d3.selectAll('#' + this.id)
                    //.transition()
                    //.duration(50)
                    .style("opacity", 1)
                    .style("stroke-width", "2.1px");
            } else if ($(this).css("opacity") == 0.3) {
                d3.selectAll('#' + this.id)
                    //.transition()
                    //.duration(50)
                    .style("opacity", 1)
                    .style("stroke-width", "2.1px");
            }
        }
    }

    function mouseout() {
        if (!brushing) {
            if ($(this).css("stroke-width") == "1.1px") {				//uses the stroke-width of the line clicked on to determine whether to turn the line on or off
                d3.selectAll('#' + this.id)
                    //.transition()
                    //.duration(50)
                    .style("opacity", 0.3)
                    .style("stroke-width", "1px");
            }
        }
    }

}

function updatePlots(error, data) {
    if (error) throw error;

    tractdata = d3.nest()
     .key(function (d) { return d.tractID; })
     .key(function (d) { return d.subjectID; })
     .entries(data);

    function setGroups(element, index, array) {
        for (i = 0; i < element.length; i++) {
            for (z = 0; z < data.length; z++) {
                if (data[z].subjectID == element[i]) {
                    data[z].group = index
                }
            }
        }
    }

    if (subjectGroups) {
        subjectGroups.forEach(setGroups);
        tract_mean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.group; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) { return d3.mean(v, function (d) { return +d[plotsControlBox.plotKey]; }); })
        .entries(data);

        for (i = 0; i < tract_mean.length; i++) {
            for (j = 0; j < tract_mean[i].values.length; j++) {
                tractdata[i].values.push(tract_mean[i].values[j]);
            }
        }
    } else {
        tract_mean = d3.nest()
        .key(function (d) { return d.tractID; })
        .key(function (d) { return d.nodeID; })
        .rollup(function (v) { return d3.mean(v, function (d) { return +d[plotsControlBox.plotKey]; }); })
        .entries(data);
        for (i = 0; i < tract_mean.length; i++) {
            tractdata[i].values.push(tract_mean[i]);
        }
    }

    // update axes based on selected data
    y.domain(d3.extent(data, function (d) { return +d[plotsControlBox.plotKey]; }));
    x.domain([0, 100]).nice();

    // Select the section we want to apply our changes to
    var svg = d3.select("#tractdetails").selectAll("svg").data(tractdata).transition();

    /*svg.select(".x.axis") // change the x axis
        .duration(750)
        .call(xAxis);*/
    svg.select(".y.axis") // change the y axis
        .duration(750)
        .call(yAxis);

    // JOIN new data with old elements.
    var trlines = d3.select("#tractdetails").selectAll("svg").data(tractdata).selectAll(".tracts")
        .data(function (d) { return d.values; }).transition();//.select("#path").attr("d", function (d) { return d.values; });

    trlines.select("path")
        .duration(1000)
        .attr("d", function (d) { return line(d.values); });

    var meanStuff = d3.select("#tractdetails").selectAll("svg").data(tractdata).selectAll(".tracts")
        .data(function (d) { return d.values; });

    meanStuff.exit().remove();

    var newMeans = meanStuff.enter().append("g")
        .attr("class", "tracts")
        .attr("id", "Mean")
        .style("opacity", 0.99)
        .style("stroke-width", "3.5px")
        .append("path")
        .attr("class", "line")
        .attr("d", function (d) { return line(d.values); });

    // set mean colors
    if (subjectGroups) {
        d3.select("#tractdetails").selectAll("svg").selectAll("#Mean")
            .style("stroke", function (d, i) { return ramp(i); });
    };

    d3.selectAll(".brush").data([]).exit().remove();
    // generate brush
    var brush = d3.svg.brush()
        .x(x)
        .on("brush", brushed)
        .on("brushstart", brushStart)
        .on("brushend", brushEnd);

    // brush
    if (plotsControlBox.brushTract) {
        var brushg = d3.select("#tractdetails").selectAll("svg")
        .append("g")
        .attr("class", "brush")
        .call(brush);

        brushg.selectAll("rect")
            .attr("y", m.top)
            .attr("height", h - axisOffset.bottom);
    }

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
