// Tell jslint that certain variables are global
/* global afqb */

// color Palettes in Hex format, HTML needs colors in d3colors format
// colors are the Tableau20 colors
afqb.global.colors = [0x1F77B4, 0xAEC7E8, 0xFF7F0E, 0xFFBB78, 0x2CA02C, 0x98DF8A, 0xD62728, 0xFF9896, 0x9467BD, 0xC5B0D5, 0x8C564B, 0xC49C94, 0xE377C2, 0xF7B6D2, 0x7F7F7F, 0xC7C7C7, 0xBCBD22, 0xDBDB8D, 0x17BECF, 0x9EDAE5];
afqb.global.d3colors = ["#1F77B4", "#AEC7E8", "#FF7F0E", "#FFBB78", "#2CA02C", "#98DF8A", "#D62728", "#FF9896", "#9467BD", "#C5B0D5", "#8C564B", "#C49C94", "#E377C2", "#F7B6D2", "#7F7F7F", "#C7C7C7", "#BCBD22", "#DBDB8D", "#17BECF", "#9EDAE5"];
// highlightColors are same as regular colors but adding lightness using the following pseudocode
// highlightColors[i] = (colors[i] + 10 lightness) converted to RGB hex
afqb.global.highlightColors = [0x2991DB, 0xD7E4F4, 0xFF9A42, 0xFFD6AD, 0x37C837, 0xBCEAB3, 0xDF5353, 0xFFC8C7, 0xAC8ACC, 0xDDD0E6, 0xA96C60, 0xD5B9B3, 0xECA2D6, 0xFCE3EE, 0x999, 0xE0E0E0, 0xDCDC38, 0xE8E8B5, 0x30D6E8, 0xC7EAF0];
