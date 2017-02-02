// ========== Adding Table code ============

var fieldHeight = 30;
var rowPadding = 1;
var fieldWidth = 140;

var previousSort = null;
var format = d3.time.format("%m/%d/%Y");
//var dateFn = function(date) { return format.parse(d.created_at) };


var subjectGroups = false;
var subData = [];
var subGroups = {};
var splitGroups = false;

var ramp = null;
var headerGrp;
var rowsGrp;
var tableControlBox;

var subjectQ = d3_queue.queue();
subjectQ.defer(d3.json, "data/subjects.json");
subjectQ.await(buildTable);

function buildTable(error, data) {
	data.forEach(function (d) {
        if (typeof d.subjectID === 'number'){
          d.subjectID = "s" + d.subjectID.toString();}
		subData.push(d);
	});

	ramp = null;

	var tableSvg = d3.select("#table").append("svg")
		.attr("width", d3.keys(subData[0]).length * fieldWidth)
		.attr("height", (subData.length + 1) * (fieldHeight + rowPadding));

	headerGrp = tableSvg.append("g").attr("class", "headerGrp");
	rowsGrp = tableSvg.append("g").attr("class","rowsGrp");

	var tableGuiConfigObj = function () {
		this.groupCount = 2;
	};

	var tableGui = new dat.GUI({
		autoplace: false,
		width: 350,
		scrollable: false
	});

	tableControlBox = new tableGuiConfigObj();

	var tableGuiContainer = $('.tableGUI').append($(tableGui.domElement));

	var groupCountController = tableGui.add(tableControlBox, 'groupCount')
		.min(2).step(1)
		.name('Number of Groups')
		.onChange(function () {
			return refreshTable(sortOn);
		});
	tableGui.close()

	groupCountController.onChange(function () {
		refreshTable(sortOn);
	});

	tableGui.close();

	var sortOn = null;
	refreshTable(sortOn);
}

function refreshTable(sortOn){

    // create the table header
    var header = headerGrp.selectAll("g")
        .data(d3.keys(subData[0]))
        .enter().append("g")
        .attr("class", "t_header")
        .attr("transform", function (d, i){
            return "translate(" + i * fieldWidth + ",0)";
        })
        .on("mouseover", function (d,i) {
            d3.select(this).style("cursor", "n-resize");
        })
		// this is where the magic happens...(d) is the column being sorted
        .on("click", function (d) { return refreshTable(d); });

    header.append("rect")
        .attr("width", fieldWidth-1)
        .attr("height", fieldHeight);

    header.append("text")
        .attr("x", fieldWidth / 2)
        .attr("y", fieldHeight / 2)
        .attr("dy", ".35em")
        .text(String);

    // fill the table
    // select rows
    var rows = rowsGrp.selectAll("g.row").data(subData,
        function(d){ return d.subjectID; });

    // create rows
    var rowsEnter = rows.enter().append("svg:g")
        .attr("class","row")
        .attr("id", function(d){ return d.subjectID; })
        .attr("transform", function (d, i){
            return "translate(0," + (i+1) * (fieldHeight+rowPadding) + ")";
        })
        //.on('click', rowSelect )
        .on('mouseover', tableMouseDown )
        .on('mousedown', rowSelect );
    // select cells
    var cells = rows.selectAll("g.cell")
		.data(function(d){return d3.values(d);});

    // create cells
    var cellsEnter = cells.enter().append("svg:g")
        .attr("class", "cell")
				.style("opacity",0.3)
        .attr("transform", function (d, i){
            return "translate(" + i * fieldWidth + ",0)";
        });

    cellsEnter.append("rect")
        .attr("width", fieldWidth-1)
        .attr("height", fieldHeight);

    cellsEnter.append("text")
        .attr("x", fieldWidth / 2)
        .attr("y", fieldHeight / 2)
        .attr("dy", ".35em")
        .text(String);

    // Update if not in initialisation
    if (sortOn !== null) {
        // Update row order
        if(sortOn != previousSort){
            rows.sort(function(a,b){return sort(a[sortOn], b[sortOn]);});
            subData.sort(function(a,b){return sort(a[sortOn], b[sortOn]);})
            previousSort = sortOn;
        }
        else{
            rows.sort(function(a,b){return sort(b[sortOn], a[sortOn]);});
            previousSort = null;
        }

		// Get unique, non-null values from the column `sortOn`
		function uniqueNotNull(value, index, self) { 
			return (self.indexOf(value) === index) && (value !== null);
		}

		var uniques = subData
			.map(function(element) {
				return element[sortOn];
			})
			.filter(uniqueNotNull);

		// usrGroups is the user requested number of groups
		// numGroups may be smaller if there are not enough unique values
        var usrGroups = tableControlBox.groupCount;
        var numGroups = Math.min(usrGroups, uniques.length);

		// Create groupScale to map between the unique
		// values and the discrete group indices.
		var groupScale;
		// TODO: Use the datatype json instead of
		// just testing the first element of uniques
		if (typeof uniques[0] === 'number') {
			groupScale = d3.scale.quantile()
				.range(d3.range(numGroups));
		} else {
			var rangeOrdinal = Array(uniques.length);
			for (i = 0; i < numGroups; i++) {
				rangeOrdinal.fill(i,
						i * uniques.length / numGroups,
						(i + 1) * uniques.length / numGroups);
			}
			groupScale = d3.scale.ordinal()
				.range(rangeOrdinal);
		}
		groupScale.domain(uniques);

		// Assign group index to each element of subData
		subData.forEach(function(element) {
			if (element[sortOn] === null) {
				element["group"] = null;
				subGroups[element.subjectID] = null;
			} else {
				element["group"] = groupScale(element[sortOn]);
				subGroups[element.subjectID] = groupScale(element[sortOn]);
			}
		});

		// Prepare to split on group index
        splitGroups = d3.nest()
            .key(function (d) { return d["group"]; })
            .entries(subData);

		// Create color ramp for subject groups
        ramp = d3.scale.linear()
			.domain([0, numGroups-1]).range(["red", "blue"]);

        function idColor(element) {
			d3.selectAll('#' + element["subjectID"])
				.selectAll('.line')
				.style("stroke",
						element["group"] === null ? "black" : ramp(element["group"]));

			d3.selectAll('#' + element["subjectID"])
				.selectAll('.cell').select('text')
				.style("fill",
						element["group"] === null ? "black" : ramp(element["group"]));
        }

        subData.forEach(idColor); // color lines

		// call update -> noticed there is a delay here.
		// update plots may be the slow down
        d3.csv("data/nodes.csv", updatePlots);

        rows//.transition() // sort row position
           //.duration(500)
           .attr("transform", function (d, i) {
               return "translate(0," + (i + 1) * (fieldHeight + 1) + ")";
           });

    }
}

function sort(a,b){
    if(typeof a == "string"){
        var parseA = format.parse(a);
        if(parseA){
            var timeA = parseA.getTime();
            var timeB = format.parse(b).getTime();
            return timeA > timeB ? 1 : timeA == timeB ? 0 : -1;
        }
        else
            return a.localeCompare(b);
    }
    else if(typeof a == "number"){
        return a > b ? 1 : a == b ? 0 : -1;
    }
    else if(typeof a == "boolean"){
        return b ? 1 : a ? -1 : 0;
    }
}

// onclick function to toggle on and off rows
function rowSelect() {
    if($('g',this).css("opacity") == 0.3) {
		//uses the opacity of the row for selection and deselection
        d3.selectAll('#' + this.id)
			.selectAll('g')
            .style("opacity", 1);

		d3.selectAll('#' + this.id)
			.selectAll('path')
            .style("opacity", 1)
            .style("stroke-width", "2.1px");
    } else {
		d3.selectAll('#' + this.id)
			.selectAll('g')
			.style("opacity", 0.3);

        d3.selectAll('#' + this.id)
			.selectAll('path')
            .style("opacity", plotsControlBox.lineOpacity)
            .style("stroke-width", "1.1px");
	}
}

var isDown = false;   // Tracks status of mouse button

$(document).mousedown(function() {
		// When mouse goes down, set isDown to true
		isDown = true;
	})
    .mouseup(function() {
		// When mouse goes up, set isDown to false
        isDown = false;
    });

function tableMouseDown() {
	if(isDown) {
		if($('g',this).css("opacity") == 0.3) {
			//uses the opacity of the row for selection and deselection
			d3.selectAll('#' + this.id)
				.selectAll('g')
				.style("opacity", 1);

			d3.selectAll('#' + this.id)
				.selectAll('path')
				.style("opacity", 1)
				.style("stroke-width", "2.1px");
		} else {
			d3.selectAll('#' + this.id)
				.selectAll('g')
				.style("opacity", 0.3);

			d3.selectAll('#' + this.id)
				.selectAll('path')
				.style("opacity", plotsControlBox.lineOpacity)
				.style("stroke-width", "1.1px");
		}
	}
}
