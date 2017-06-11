// ========== Adding Table code ============

afqb.table.fieldHeight = 30;
afqb.table.rowPadding = 1;
afqb.table.fieldWidth = 140;

afqb.table.format = d3.time.format("%m/%d/%Y");
//var dateFn = function(date) { return format.parse(d.created_at) };

afqb.table.subData = [];
afqb.table.subGroups = {};
afqb.table.splitGroups = false;

afqb.table.ramp = null;
afqb.table.headerGrp;
afqb.table.rowsGrp;

afqb.table.buildTable = function (error, data) {
	afqb.table.settings.sort = {};
	afqb.table.settings.sort.key = null;
	afqb.table.settings.sort.order = "ascending";
	afqb.table.settings.sort.count = 2;
	afqb.table.settings.prevSort = {};
	afqb.table.settings.prevSort.key = null;
	afqb.table.settings.prevSort.order = "ascending";
	afqb.table.settings.prevSort.count = 2;

	data.forEach(function (d) {
        if (typeof d.subjectID === 'number'){
          d.subjectID = "s" + d.subjectID.toString();}
		afqb.table.subData.push(d);
	});

	afqb.table.ramp = null;

	var tableSvg = d3.select("#table").append("svg")
		.attr("width", d3.keys(afqb.table.subData[0]).length * afqb.table.fieldWidth)
		.attr("height", "100%")
		.attr("display", "flex")
		.attr("flex-direction", "column");
		// .attr("height", (afqb.table.subData.length + 1) * (afqb.table.fieldHeight + afqb.table.rowPadding));

	afqb.table.headerGrp = tableSvg.append("g").attr("class", "headerGrp")
		.attr("flex", "0 1 auto");
	afqb.table.rowsGrp = tableSvg.append("g").attr("class","rowsGrp")
		.attr("flex", "1 1 auto");
		//.attr("height", afqb.table.subData.length * (afqb.table.fieldHeight + afqb.table.rowPadding));

	var tableGuiConfigObj = function () {
		this.groupCount = afqb.table.settings.sort.count;
	};

	var tableGui = new dat.GUI({
		autoplace: false,
		width: 350,
		scrollable: false
	});

	var tableGuiContainer = document.getElementById('table-gui-container');
	tableGuiContainer.appendChild(tableGui.domElement);

	afqb.global.controls.tableControlBox = new tableGuiConfigObj();

	var groupCountController = tableGui.add(afqb.global.controls.tableControlBox, 'groupCount')
		.min(2).step(1)
		.name('Number of Groups')
		.onChange(function (value) {
			afqb.table.settings.sort.count = value;
			afqb.table.refreshTable();
		});

	tableGui.close();

	afqb.table.refreshTable();
}

afqb.table.refreshTable = function () {
    // create the table header
    var header = afqb.table.headerGrp.selectAll("g")
        .data(d3.keys(afqb.table.subData[0]))
        .enter().append("g")
        .attr("class", "t_header")
        .attr("transform", function (d, i){
            return "translate(" + i * afqb.table.fieldWidth + ",0)";
        })
        .on("mouseover", function (d,i) {
            d3.select(this).style("cursor", "n-resize");
        })
		// this is where the magic happens...(d) is the column being sorted
        .on("click", function (d) {
			afqb.table.settings.sort.key = d;
			afqb.table.refreshTable();
		});

    header.append("rect")
        .attr("width", afqb.table.fieldWidth-1)
        .attr("height", afqb.table.fieldHeight);

    header.append("text")
        .attr("x", afqb.table.fieldWidth / 2)
        .attr("y", afqb.table.fieldHeight / 2)
        .attr("dy", ".35em")
        .text(String);

    // fill the table
    // select rows
    var rows = afqb.table.rowsGrp.selectAll("g.row").data(afqb.table.subData,
        function(d){ return d.subjectID; });

    // create rows
    var rowsEnter = rows.enter().append("svg:g")
        .attr("class","row")
        .attr("id", function(d){ return d.subjectID; })
        .attr("transform", function (d, i){
            return "translate(0," + (i+1) * (afqb.table.fieldHeight+afqb.table.rowPadding) + ")";
        })
        //.on('click', afqb.table.rowSelect )
        .on('mouseover', afqb.table.tableMouseDown )
        .on('mousedown', afqb.table.rowSelect );

    // select cells
    var cells = rows.selectAll("g.cell")
		.data(function(d){return d3.values(d);});

    // create cells
    var cellsEnter = cells.enter().append("svg:g")
        .attr("class", "cell")
				.style("opacity",0.3)
        .attr("transform", function (d, i){
            return "translate(" + i * afqb.table.fieldWidth + ",0)";
        });

    cellsEnter.append("rect")
        .attr("width", afqb.table.fieldWidth-1)
        .attr("height", afqb.table.fieldHeight);

    cellsEnter.append("text")
        .attr("x", afqb.table.fieldWidth / 2)
        .attr("y", afqb.table.fieldHeight / 2)
        .attr("dy", ".35em")
        .text(String);

	var sortOn = afqb.table.settings.sort.key;
    // Update if not in initialisation
    if (sortOn !== null) {
        // If sort.key and sort.count are the same, just update the row order
        if(sortOn === afqb.table.settings.prevSort.key
				&& afqb.table.settings.sort.count === afqb.table.settings.prevSort.count){
			if (afqb.table.settings.prevSort.order === "ascending") {
				rows.sort(function(a,b){
					return afqb.table.descendingWithNull(a[sortOn], b[sortOn]);
				});
				afqb.table.settings.prevSort.order = "descending";
			} else {
				rows.sort(function(a,b){
					return afqb.table.ascendingWithNull(a[sortOn], b[sortOn]);
				});
				afqb.table.settings.prevSort.order = "ascending";
			}
			afqb.table.settings.prevSort.count = afqb.table.settings.sort.count;
        } else {
			// Only resort the data if the sort key is different
			if(sortOn !== afqb.table.settings.prevSort.key) {
				rows.sort(function(a,b){
					return afqb.table.ascendingWithNull(a[sortOn], b[sortOn]);
				});
				afqb.table.subData.sort(function(a,b){
					return afqb.table.ascendingWithNull(a[sortOn], b[sortOn]);
				});
			}
			afqb.table.settings.prevSort.key = sortOn;
			afqb.table.settings.prevSort.order = "ascending";

			// Get unique, non-null values from the column `sortOn`
			function uniqueNotNull(value, index, self) {
				return (self.indexOf(value) === index) && (value !== null);
			}

			var uniques = afqb.table.subData
				.map(function(element) {
					return element[sortOn];
				})
			.filter(uniqueNotNull);

			// usrGroups is the user requested number of groups
			// numGroups may be smaller if there are not enough unique values
			var usrGroups = afqb.table.settings.sort.count;
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

			// Assign group index to each element of afqb.table.subData
			afqb.table.subData.forEach(function(element) {
				if (element[sortOn] === null) {
					element["group"] = null;
					afqb.table.subGroups[element.subjectID] = null;
				} else {
					element["group"] = groupScale(element[sortOn]);
					afqb.table.subGroups[element.subjectID] = groupScale(element[sortOn]);
				}
			});

			// Prepare to split on group index
			afqb.table.splitGroups = d3.nest()
				.key(function (d) { return d["group"]; })
				.entries(afqb.table.subData);

			// Create color ramp for subject groups
			afqb.table.ramp = d3.scale.linear()
				.domain([0, numGroups-1]).range(["red", "blue"]);

			function idColor(element) {
				d3.selectAll('#' + element["subjectID"])
					.selectAll('.line')
					.style("stroke",
							element["group"] === null ? "black" : afqb.table.ramp(element["group"]));

				d3.selectAll('#' + element["subjectID"])
					.selectAll('.cell').select('text')
					.style("fill",
							element["group"] === null ? "black" : afqb.table.ramp(element["group"]));
			}

			afqb.table.subData.forEach(idColor); // color lines

			d3.csv("data/nodes.csv", afqb.plots.changePlots);
			afqb.table.settings.prevSort.count = afqb.table.settings.sort.count;

		}

        rows//.transition() // sort row position
           //.duration(500)
           .attr("transform", function (d, i) {
               return "translate(0," + (i + 1) * (afqb.table.fieldHeight + 1) + ")";
           });
    }
}

afqb.table.ascendingWithNull = function (a, b) {
	// d3.ascending ignores null and undefined values
	// Return the same as d3.ascending but keep all null and
	// undefined values at the bottom of the list
	return b == null ? -1 : a == null ? 1 : d3.ascending(a, b);
}

afqb.table.descendingWithNull = function (a, b) {
	// d3.descending ignores null and undefined values
	// Return the same as d3.descending but keep all null and
	// undefined values at the bottom of the list
	return b == null ? -1 : a == null ? 1 : d3.descending(a, b);
}

// onclick function to toggle on and off rows
afqb.table.rowSelect = function () {
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
            .style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
            .style("stroke-width", "1.1px");
	}
}

afqb.global.mouse.isDown = false;   // Tracks status of mouse button

$(document).mousedown(function() {
		// When mouse goes down, set isDown to true
		afqb.global.mouse.isDown = true;
	})
    .mouseup(function() {
		// When mouse goes up, set isDown to false
        afqb.global.mouse.isDown = false;
    });

afqb.table.tableMouseDown = function () {
	if(afqb.global.mouse.isDown) {
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
				.style("opacity", afqb.global.controls.plotsControlBox.lineOpacity)
				.style("stroke-width", "1.1px");
		}
	}
}

afqb.global.queues.subjectQ = d3_queue.queue();
afqb.global.queues.subjectQ.defer(d3.json, "data/subjects.json");
afqb.global.queues.subjectQ.await(afqb.table.buildTable);
