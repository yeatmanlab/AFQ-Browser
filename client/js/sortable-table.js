// ========== Adding Table code ============

var fieldHeight = 30;
var fieldWidth = 140;

var previousSort = null;
var format = d3.time.format("%m/%d/%Y");
//var dateFn = function(date) { return format.parse(d.created_at) };



var sub_data = []

d3.json("/data/subjects.json", function (data) {
    data.forEach(function (d) {
        sub_data.push(d);
    });
    console.log(JSON.stringify(sub_data));
    refreshTable(null);
});

/*
var sub_data = [
    { "ID": 'Subject1', "GENDER": "M", "DOB": "12/4/1980", "R SCORE": 90, "SYMPTOMATIC": true },
    { "ID": 'Subject2', "GENDER": "F", "DOB": "10/23/1981", "R SCORE": 122, "SYMPTOMATIC": false },
    { "ID": 'Subject3', "GENDER": "M", "DOB": "1/12/1980", "R SCORE": 112, "SYMPTOMATIC": false },
    { "ID": 'Subject4', "GENDER": "M", "DOB": "4/23/1982", "R SCORE": 125, "SYMPTOMATIC": false },
    { "ID": 'Subject6', "GENDER": "M", "DOB": "8/25/1979", "R SCORE": 109, "SYMPTOMATIC": false },
    { "ID": 'Subject5', "GENDER": "F", "DOB": "10/26/1983", "R SCORE": 97, "SYMPTOMATIC": true },
    { "ID": 'Subject7', "GENDER": "M", "DOB": "9/4/1980", "R SCORE": 118, "SYMPTOMATIC": false },
    { "ID": 'Subject9', "GENDER": "F", "DOB": "6/22/1980", "R SCORE": 95, "SYMPTOMATIC": false },
    { "ID": 'Subject8', "GENDER": "M", "DOB": "2/14/1983", "R SCORE": 87, "SYMPTOMATIC": true },
    { "ID": 'Subject0', "GENDER": "F", "DOB": "11/3/1982", "R SCORE": 115, "SYMPTOMATIC": false }
];*/

var table_svg = d3.select("#table").append("svg")
    .attr("width", 700)
    .attr("height", 400);

var ramp = null;

var headerGrp = table_svg.append("g").attr("class", "headerGrp");
var rowsGrp = table_svg.append("g").attr("class","rowsGrp");


refreshTable(null);

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

var groupCountController = tableGui.add(tableControlBox, 'groupCount')
    .name('Number of Groups');

groupCountController.onChange(function () {
    refreshTable(sortOn);
});

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

    //header.append('input') <--- not necessary for sort
      //.attr("type", "checkbox");

    // fill the table
    // select rows
    var rows = rowsGrp.selectAll("g.row").data(sub_data,
        function(d){ return d.ID; });

    // create rows
    var rowsEnter = rows.enter().append("svg:g")
        .attr("class","row")
        .attr("id", function(d){ return d.ID; })
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
        //rows.transition()
        //    .duration(500)
        //    .attr("transform", function (d, i){
        //        return "translate(0," + (i+1) * (fieldHeight+1) + ")";
        //    });

        var splitGroups = d3.nest()
            .key(function (d) { return d[sortOn]; })
            .entries(sub_data);

        var numGroups = tableControlBox.groupCount;
        var finalSplit = Math.min(numGroups, splitGroups.length)

        var subjectGroups = []
        for (g = 0; g < finalSplit; g++) {
            var group_arr = [];
            var groupSize = Math.floor(sub_data.length / finalSplit);
            var splitSize = Math.floor(splitGroups.length / finalSplit);
            if (splitSize == 1) {
                for (j = 0; j < splitGroups[g].values.length; j++) {
                    group_arr.push(splitGroups[g].values[j].ID);
                }
            } else { //if (splitSize = groupSize) {
                var stopGroup = (g + 1) * groupSize;
                for (k = g * groupSize; k < stopGroup; k++) {
                    group_arr.push(splitGroups[k].values[0].ID);
                }
            };
            subjectGroups.push(group_arr);
        }

        var ordered_subject



        //console.log(JSON.stringify(subjectGroups));

        var ramp = d3.scale.linear().domain([0, finalSplit-1]).range(["red", "blue"]);

        function IDcolor(element, index, array) {
            for (i = 0; i < element.length; i++) {
                d3.selectAll('#' + element[i])
                .transition()
                .duration(500)
                .style("stroke", ramp(index));
            }
        }

        subjectGroups.forEach(IDcolor);

        rows.transition()
           .duration(500)
           .attr("transform", function (d, i) {
               return "translate(0," + (i + 1) * (fieldHeight + 1) + ")";
           });
        //update cells
        // rows.selectAll("g.cell").select("text").text(String);
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
