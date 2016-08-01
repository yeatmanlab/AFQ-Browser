//tracklist js

//Data : track names
var tracks=["Left Thalamic Radiation","Right Thalamic Radiation","Left Corticospinal","Right Corticospinal","Left Cingulum Cingulate","Right Cingulum Cingulate","Left Cingulum Hippocampus","Right Cingulum Hippocampus","Callosum Forceps Major","Callosum Forceps Minor","Left IFOF","Right IFOF","Left ILF","Right ILF","Left SLF","Right SLF","Left Uncinate","Right Uncinate","Left Arcuate","Right Arcuate"]

// color Palettes in Hex format, HTML needs colors in d3colors format
// colors are the Tableau20 colors
var colors = [0x1F77B4, 0xAEC7E8, 0xFF7F0E, 0xFFBB78, 0x2CA02C, 0x98DF8A, 0xD62728, 0xFF9896, 0x9467BD, 0xC5B0D5, 0x8C564B, 0xC49C94, 0xE377C2, 0xF7B6D2, 0x7F7F7F, 0xC7C7C7, 0xBCBD22, 0xDBDB8D, 0x17BECF, 0x9EDAE5];
var d3colors = ["#1F77B4", "#AEC7E8", "#FF7F0E", "#FFBB78", "#2CA02C", "#98DF8A", "#D62728", "#FF9896", "#9467BD", "#C5B0D5", "#8C564B", "#C49C94", "#E377C2", "#F7B6D2", "#7F7F7F", "#C7C7C7", "#BCBD22", "#DBDB8D", "#17BECF", "#9EDAE5"];
// highlightColors[i] = (colors[i] + 10 lightness) converted to RGB hex
var highlightColors = [0x2991DB, 0xD7E4F4, 0xFF9A42, 0xFFD6AD, 0x37C837, 0xBCEAB3, 0xDF5353, 0xFFC8C7, 0xAC8ACC, 0xDDD0E6, 0xA96C60, 0xD5B9B3, 0xECA2D6, 0xFCE3EE, 0x999, 0xE0E0E0, 0xDCDC38, 0xE8E8B5, 0x30D6E8, 0xC7EAF0];

var m = {top: 20, right: 10, bottom: 10, left: 20},
w = 400 - m.left - m.right,
h = 350 - m.top - m.bottom;

// init variable to hold data later
var trackdata = d3.map();

//insert trackname checkboxes in the tracklist panel
var svg = d3.select('#tracklist').selectAll(".input").data(tracks).enter().append('div');
svg.append('input')
      .attr("type", "checkbox")
      .attr("class", "tracks")
      .attr("id", function(d,i){return "input"+(i+1);})
      .attr("name", function (d, i) { return i; })
// add label to the checkboxes
svg.append('label')
      .text(function (d) { return d; })
      .attr("for",function(d,i){return "input"+(i+1); })
      .attr("id", function(d,i){return "label"+i;});

  //add event handler to the checkbox
d3.selectAll(".tracks")
  .on("change", function () {
    var state = this.checked
    var name = this.name
    //call trackdetails handler
    showHideTrackDetails(state, name)
});


// all select/un-select all checkbox
d3.selectAll("#selectAllTracks")
  .on("change", function () {
    var state = this.checked;
    if (state) {
      d3.selectAll(".tracks").each(function(d, i) {
        this.checked = true;
        showHideTrackDetails(this.checked, this.name);
      });
    } else {
      d3.selectAll(".tracks").each(function(d, i) {
        this.checked = false;
        showHideTrackDetails(this.checked, this.name);
      });
    }

});



function showHideTrackDetails(state, name)
{
  if (state==true){
    d3.select("#track"+name).style("display", "inline");
      d3.select("#label"+name)
        .style("color",d3colors[name]);
  }
  else {
    d3.select("#track"+name).style("display", "none");
    d3.select("#label"+name)
      .style("color","#111111");
  }

}


var $window = $(window),
   $stickyEl = $('#statcontent'),
   elTop = $stickyEl.offset().top;

$window.scroll(function() {
    $stickyEl.toggleClass('sticky', $window.scrollTop() > elTop);
});
