// Tell jslint that afqb is a global variable
/* global afqb */

/**
 * Updates document.title and heading text based on content of afqb.global.settings.html
 */
afqb.global.updateHeadings = function () {
    // Change the title in the html header
    document.title = afqb.global.settings.html.title || "AFQ Browser";
    
    // Get the h1 title
    var title = document.getElementById("title-bar-title");
    // If user specified a link, then create an "a" tag and fill it appropriately
    // else, just put the text
    if (afqb.global.settings.html.link) {
        var a = document.createElement("a");
        a.href = afqb.global.settings.html.link;
        a.innerHTML = afqb.global.settings.html.title || "AFQ Browser";
        title.innerHTML = "";
        title.appendChild(a);
    } else {
        title.innerHTML = afqb.global.settings.html.title || "AFQ Browser";
    }

    if (afqb.global.settings.html.subtitle) {
        // If the user specified a subtitle then add a span tag to the title-bar 
        var subtitle = $('#title-bar-subtitle');
        if (afqb.global.settings.html.sublink) {
            var a = document.createElement("a");
            a.href = afqb.global.settings.html.sublink;
            a.innerHTML = afqb.global.settings.html.subtitle || "";
            subtitle.html("");
            subtitle.append(a);
        } else {
            subtitle.html(afqb.global.settings.html.subtitle || "");
        }
        $('#title-bar-separator').css("visibility", "visible");
    }
    
    afqb.global.settings.html.title = document.title;
};

afqb.global.queues.headingsQ = d3_queue.queue();
afqb.global.queues.headingsQ.defer(afqb.global.initSettings);
afqb.global.queues.headingsQ.await(afqb.global.updateHeadings);