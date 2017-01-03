// ========== Adding Table code ============

var fieldHeight = 30;
var fieldWidth = 140;

var previousSort = null;
var format = d3.time.format("%m/%d/%Y");
//var dateFn = function(date) { return format.parse(d.created_at) };


var subjectGroups = false;
var sub_data = []

d3.json("/data/subjects.json", function (data) {
    data.forEach(function (d) {
        d.subjectID = "s" + d.subjectID.toString();
        sub_data.push(d);
    });
    refreshTable(null);
});

var table_svg = d3.select("#table").append("svg")
    .attr("width", 2000)
    .attr("height", 1500);

var ramp = null;

var headerGrp = table_svg.append("g").attr("class", "headerGrp");
var rowsGrp = table_svg.append("g").attr("class","rowsGrp");


var tableGuiConfigObj = function () {
    this.groupCount = 2;
};

var tableGui = new dat.GUI({
    autoplace: false,
    width: 350,
    scrollable: false
});

var tableControlBox = new tableGuiConfigObj();

// gui.domElement.id = 'gui';
var tableGuiContainer = $('.tableGUI').append($(tableGui.domElement));

var groupCountController = tableGui.add(tableControlBox, 'groupCount').min(2).step(1)
    .name('Number of Groups')
    .onChange(function () {
        return refreshTable(sortOn); // Not really sure why this isn't working
    });
tableGui.close()

var sortOn = null
refreshTable(sortOn)

function refreshTable(sortOn){

    // create the table header
    var header = headerGrp.selectAll("g")
        .data(d3.keys(sub_data[0]))
        .enter().append("g")
        .attr("class", "t_header")
        .attr("transform", function (d, i){
            return "translate(" + i * fieldWidth + ",0)";
        })
        .on("mouseover", function (d,i) {
            d3.select(this).style("cursor", "n-resize");
        })
        .on("click", function (d) { return refreshTable(d); }); // this is where the magic happens... (d) is the column being sorted

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
    var rows = rowsGrp.selectAll("g.row").data(sub_data,
        function(d){ return d.subjectID; });

    // create rows
    var rowsEnter = rows.enter().append("svg:g")
        .attr("class","row")
        .attr("id", function(d){ return d.subjectID; })
        .attr("opacity",0.3)
        .attr("transform", function (d, i){
            return "translate(0," + (i+1) * (fieldHeight+1) + ")";
        })
        //.on('click', row_select )
        .on('mouseover', table_mouseDown )
        .on('mousedown', row_select );
    // select cells
    var cells = rows.selectAll("g.cell").data(function(d){return d3.values(d);});

    // create cells
    var cellsEnter = cells.enter().append("svg:g")
        .attr("class", "cell")
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

    //update if not in initialisation
    if (sortOn !== null) {
        // update rows
        if(sortOn != previousSort){
            rows.sort(function(a,b){return sort(a[sortOn], b[sortOn]);});
            previousSort = sortOn;
        }
        else{
            rows.sort(function(a,b){return sort(b[sortOn], a[sortOn]);});
            previousSort = null;
        }

        // prepare to split on metadata
        var splitGroups = d3.nest()
            .key(function (d) { return d[sortOn]; })
            .sortKeys(d3.ascending)
            .entries(sub_data);

        var usrGroups = tableControlBox.groupCount;
        var numGroups = Math.min(usrGroups, splitGroups.length)


        // push subject ids into respective groups
        subjectGroups = []
        var groupSize = Math.round(sub_data.length / numGroups);
        var splitSize = Math.round(splitGroups.length / numGroups);

        if (splitSize == 1) { // corresponds to one group for each unique value in d[sortOn]
            for (g = 0; g < numGroups; g++) {
                var group_arr = [];
                for (j = 0; j < splitGroups[g].values.length; j++) {
                    group_arr.push(splitGroups[g].values[j].subjectID);
                }
                subjectGroups.push(group_arr);
            }
        } else { // mixed continuous and repeat values (splitSize < groupSize) This part's still messed up!
            for (g = 0; g < numGroups; g++) {
                var group_arr = [];
                var stopGroup = (g + 1) * groupSize;
                for (k = g * groupSize; k < stopGroup; k++) {
                    if (k<splitGroups.length){
                      for (j = 0; j < splitGroups[k].values.length; j++) {
                          group_arr.push(splitGroups[k].values[j].subjectID);
                        }
                    }
                }
                subjectGroups.push(group_arr);
            }
        };

        ramp = d3.scale.linear().domain([0, numGroups-1]).range(["red", "blue"]); // color ramp for subject groups

        function IDcolor(element, index, array) {
            for (i = 0; i < element.length; i++) {
                d3.selectAll('#' + element[i])
                //.transition()
                //.duration(500)
                .style("stroke", ramp(index));
            }
        }

        subjectGroups.forEach(IDcolor); // color lines

        d3.csv("data/nodes.csv", updatePlots); // call update -> noticed there is a delay here. update plots may be the slow down

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

function row_select() {                           //onclick function to toggle on and off rows
    if($(this).css("opacity") == 0.3){				  //uses the opacity of the row for selection and deselection

        d3.selectAll('#' + this.id)
            .transition()
            .duration(50)
            .style("opacity", 1)
            .style("stroke-width", "2.1px");
    } else {

        d3.selectAll('#' + this.id)
            .transition()
            .duration(50)
            .style("opacity", 0.3)
            .style("stroke-width", "1.1px");}
}

var isDown = false;   // Tracks status of mouse button

$(document).mousedown(function() {
    isDown = true;      // When mouse goes down, set isDown to true
})
    .mouseup(function() {
        isDown = false;    // When mouse goes up, set isDown to false
    });


function table_mouseDown() {
    if(isDown) {
        if($(this).css("opacity") == 0.3){				  //uses the opacity of the row for selection and deselection

            d3.selectAll('#' + this.id)
                .transition()
                .duration(50)
                .style("opacity", 1)
                .style("stroke-width", "2.1px");
        } else {

            d3.selectAll('#' + this.id)
                .transition()
                .duration(50)
                .style("opacity", 0.3)
                .style("stroke-width", "1px");}
    }
}
