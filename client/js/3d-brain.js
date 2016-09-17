//tracklist js

//Data : track names
var tracks=["Left Thalamic Radiation","Right Thalamic Radiation","Left Corticospinal","Right Corticospinal","Left Cingulum Cingulate","Right Cingulum Cingulate","Left Cingulum Hippocampus","Right Cingulum Hippocampus","Callosum Forceps Major","Callosum Forceps Minor","Left IFOF","Right IFOF","Left ILF","Right ILF","Left SLF","Right SLF","Left Uncinate","Right Uncinate","Left Arcuate","Right Arcuate"]

// color Palettes in Hex format, HTML needs colors in d3colors format
// colors are the Tableau20 colors
var colors = [0x1F77B4, 0xAEC7E8, 0xFF7F0E, 0xFFBB78, 0x2CA02C, 0x98DF8A, 0xD62728, 0xFF9896, 0x9467BD, 0xC5B0D5, 0x8C564B, 0xC49C94, 0xE377C2, 0xF7B6D2, 0x7F7F7F, 0xC7C7C7, 0xBCBD22, 0xDBDB8D, 0x17BECF, 0x9EDAE5];
var d3colors = ["#1F77B4", "#AEC7E8", "#FF7F0E", "#FFBB78", "#2CA02C", "#98DF8A", "#D62728", "#FF9896", "#9467BD", "#C5B0D5", "#8C564B", "#C49C94", "#E377C2", "#F7B6D2", "#7F7F7F", "#C7C7C7", "#BCBD22", "#DBDB8D", "#17BECF", "#9EDAE5"];
// highlightColors[i] = (colors[i] + 10 lightness) converted to RGB hex
var highlightColors = [0x2991DB, 0xD7E4F4, 0xFF9A42, 0xFFD6AD, 0x37C837, 0xBCEAB3, 0xDF5353, 0xFFC8C7, 0xAC8ACC, 0xDDD0E6, 0xA96C60, 0xD5B9B3, 0xECA2D6, 0xFCE3EE, 0x090909, 0xE0E0E0, 0xDCDC38, 0xE8E8B5, 0x30D6E8, 0xC7EAF0];

var m = {top: 20, right: 10, bottom: 10, left: 20},
w = 400 - m.left - m.right,
h = 350 - m.top - m.bottom;


// =========== three js part

var container;

var camera, scene, renderer;
var directionalLight;

var sizeX = 600, sizeY = 500;

var brain;
var lh, rh;

var groups = new THREE.Object3D();
var line_material = new THREE.LineBasicMaterial({
	opacity: 0.5,
	linewidth: 1.25
});

line_material.color.setHex( 0x969696 );


init();
animate();

var mouseDown = 0;
var mouseMove = false;
document.body.onmousedown = function() {
  ++mouseDown;
}
document.body.onmouseup = function() {
  --mouseDown;
}

// Hard coded FA plot data length
// TODO: Read this from an input file so that the user can change fidelity
var faPlotLength = 100;

var showStats = false;
var stats;

function init() {

    // We put the container inside a div with id #threejsbrain
    var puthere = document.getElementById("threejsbrain");
    container = document.createElement('div');
    puthere.appendChild(container);

    // var WIDTH = window.innerWidth,
        // HEIGHT = window.innerHeight;

    Width = container.clientWidth;

    var brainOpacity = 0.05;
    var lineInitialOpacity = 0.3;

    // camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 1, 2000);
    camera = new THREE.PerspectiveCamera( 45, Width / sizeY, 1, 2000 );
    camera.position.y = -15;
	camera.up.set(0, 0, 1);

    // scene
    scene = new THREE.Scene();

    var ambient = new THREE.AmbientLight(0x111111);
    scene.add(ambient);

    directionalLight = new THREE.DirectionalLight(0xffeedd, 1);
    directionalLight.position.set(0, -1, 0);
    scene.add(directionalLight);

    // texture
    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        //console.log(item, loaded, total);
    };

    // renderer
    renderer = new THREE.WebGLRenderer();

    renderer.setSize(Width, sizeY);
    container.appendChild(renderer.domElement);

    // dom event
    domEvents = new THREEx.DomEvents(camera, renderer.domElement);

    // model
    // Load our brain
    material = new THREE.MeshBasicMaterial();

    // load brain surface
    var loader = new THREE.OBJLoader(manager);
    loader.load('data/freesurf.OBJ', function (object) {
        brain = object;
        rh = object.getObjectByName('rh.pial.asc');
        lh = object.getObjectByName('lh.pial.asc');

        object.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material.opacity = brainOpacity;
                child.material.depthWrite = false;
                child.material.transparent = true;
            }
        });

		object.rotation.x = Math.PI / 2;
		object.scale.set(1.75, 1.75, 1.75);
        scene.add(object);
    });

	var guiConfigObj = {"Brain Opacity" : 0.1};
	var gui = new DAT.GUI({ autoPlace: false });
	// gui.domElement.id = 'gui';
	var guiContainer = $('.moveGUI').append($(gui.domElement));
	var opacity = gui.add(guiConfigObj, "Brain Opacity", 0, 1);
	gui.close();

	opacity.onChange( function(value) {
		brain.traverse(function (child) {
			if (child instanceof THREE.Mesh) {
				child.material.opacity = value;
			}
		})
	});

    // contain all bundles in this Group object
    // each bundle is represented by an Object3D
    // load fiber bundle using jQuery
	var bundleIdx = 0;
    $.getJSON("data/data_partial.json", function(json) {
        for (var key in json) {
            if (json.hasOwnProperty(key)) {
                var oneBundle = json[key];
				var nFibers = 0;

				// subkeys correspond to individual fibers in each fiber bundle
				// They may not be consecutive keys depending on the
				// downsampling of the input data, hence the need for `nFibers`
				// and `iFiber`
				//
				// First loop simply counts the number of fibers in this bundle
				// and asserts that each individual fiber has been resampled to
				// the size of the FA plot data.
                for (var subkey in oneBundle) {
                    if (oneBundle.hasOwnProperty(subkey)) {
						++nFibers;
						var oneFiber = oneBundle[subkey];
						if (oneFiber.length !== faPlotLength) {
							var errMessage = 'Streamlines have unexpected length';
							if (typeof Error !== 'undefined') {
								throw new Error(errMessage);
							}
							throw errMessage;
						}
					}
				}

				// Positions will hold x,y,z vertices for each fiber
				var positions = new Float32Array(
						nFibers * (faPlotLength - 1) * 3 * 2);

				// Outer loop is along the length of each fiber.
				// Inner loop cycles through each fiber group.
				// This is counterintuitive but we want spatial locality to
				// be preserved in index locality. This will make brushing
				// much easier in the end.
                for (var i = 0; i < faPlotLength - 1; i++) {
					var iFiber = 0;
					for (var subkey in oneBundle) {
						if (oneBundle.hasOwnProperty(subkey)) {
							var oneFiber = oneBundle[subkey];

							// Vertices must be added in pairs. Later a
							// line segment will be drawn in between each pair.
							// This requires some repeat values to have a
							// continuous line but will allow us to avoid
							// having the beginning and end of the fiber
							// connect.
							var x1 = oneFiber[i][0],
								y1 = oneFiber[i][1],
								z1 = oneFiber[i][2];

							var x2 = oneFiber[i+1][0],
								y2 = oneFiber[i+1][1],
								z2 = oneFiber[i+1][2];

							positions[i * nFibers * 6 + iFiber * 6 + 0] = x1;
							positions[i * nFibers * 6 + iFiber * 6 + 1] = y1;
							positions[i * nFibers * 6 + iFiber * 6 + 2] = z1;

							positions[i * nFibers * 6 + iFiber * 6 + 3] = x2;
							positions[i * nFibers * 6 + iFiber * 6 + 4] = y2;
							positions[i * nFibers * 6 + iFiber * 6 + 5] = z2;

							++iFiber;
                        }
                    }
                }

				// Create a buffered geometry and line segments from these
				// positions. Buffered Geometry is slightly more performant
				// and necessary to interact with d3 brushing later on.
				var bundleGeometry = new THREE.BufferGeometry();
				bundleGeometry.addAttribute('position',
						new THREE.BufferAttribute(positions, 3));

				var bundleLine = new THREE.LineSegments(bundleGeometry,
						line_material);

				// Set scale to match the brain surface,
				// (determined by trial and error)
				bundleLine.scale.set(0.05,0.05,0.05);

				// Record some useful info for later
				bundleLine.name = tracks[ bundleIdx ];
				bundleLine.nFibers = nFibers;
				bundleLine.idx = bundleIdx;
				++bundleIdx;

				// Add to the group of bundle lines.
                groups.add(bundleLine);
            }
        }

		// Set material properties for each fiber bundle
		// And add event listeners for mouseover, etc.
        groups.traverse(function (child) {
			if (child instanceof THREE.LineSegments) {
                child.material.opacity = lineInitialOpacity;
                child.material.transparent = true;
                child.position.set(0, 0.8, -0.5);

                domEvents.addEventListener(child, 'mouseover', function(event) {
        					if(!mouseDown) {
								mouseoverBundle(child.idx);
        						return renderer.render(scene, camera);
        					}
                });
                domEvents.addEventListener(child, 'mousemove', function(event) {
        					mouseMove = true;
        				});
                domEvents.addEventListener(child, 'mousedown', function(event) {
        					mouseMove = false;
        				});
				domEvents.addEventListener(child, 'mouseup', function(event) {
							if(!mouseMove) {
								var myBundle = d3.selectAll("input.tracks")[0][child.idx];
								myBundle.checked = !myBundle.checked;
								showHideTrackDetails(myBundle.checked, myBundle.name)
								highlightBundle(myBundle.checked, myBundle.name)
								return renderer.render(scene, camera);
							} else {
								mouseMove = false;
							}
						});
                domEvents.addEventListener(child, 'mouseout', function(event) {
        					var myBundle = d3.selectAll("input.tracks")[0][child.idx];
        					showHideTrackDetails(myBundle.checked, myBundle.name)
        					highlightBundle(myBundle.checked, myBundle.name)
        					return renderer.render(scene, camera);
                });
            }
        });

		// Finally add fiber bundle group to the scene.
  		scene.add(groups);
    });

	if (showStats ) {
		stats = new Stats();
		container.appendChild( stats.dom );
	}

    window.addEventListener('resize', onWindowResize, false);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', lightUpdate);
}

// Resize the three.js window on full window resize.
function onWindowResize() {
    var Width = container.clientWidth;

    camera.aspect = Width / sizeY;
    camera.updateProjectionMatrix();

    renderer.setSize(Width, sizeY);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
	if (showStats )
		stats.update();

	// For each fiber bundle update the length of fiber to be plotted
	// based on the d3 brushes in the FA plots
	for (var i = 0; i < groups.children.length; i++) {
		var track = 'track' + i;
		var lo = Math.floor(bundleBrush[track].brushExtent[0]);
		var hi = Math.ceil(bundleBrush[track].brushExtent[1]) - 1;

		// loIdx is the low index and count is the number of indices
		// This is a little sloppy and sometimes the count will be too high
		// but the visual offset should be minimal.
		// TODO: Positions come in pairs, with all vertices except the first
		// and last being repeated. Take this into account to make loIdx and
		// count correct (not just good enough).
		var loIdx = lo * groups.children[i].nFibers * 2;
		var count = (hi - lo) * groups.children[i].nFibers * 2;

		// Set the drawing range based on the brush extent.
		groups.children[i].geometry.setDrawRange(loIdx, count);
	}
}

function lightUpdate() {
    directionalLight.position.copy(camera.position);
}

// Highlight specified bundle based on left panel checkboxes
function highlightBundle(state, name) {

	// Temporary line material for highlighted bundles
	var tem_line_material = new THREE.LineBasicMaterial({
		opacity: 0.5,
		linewidth: 2.5,
        transparent: true
	});

	bundle = groups.children[name];

	if (bundle !== undefined) {
		if (state === true) {
			tem_line_material.color.setHex( colors[name] );
			bundle.material = tem_line_material;
			return renderer.render(scene, camera);

		} else {
			bundle.material = line_material;
			return renderer.render(scene, camera);
		}
	}
}

// Highlight specified bundle based on mouseover
function mouseoverBundle(name) {

	// Temporary line material for moused-over bundles
	var tem_line_material = new THREE.LineBasicMaterial({
		opacity: 0.75,
		linewidth: 2,
		transparent: true
	});

	bundle = groups.children[name];

	if (bundle !== undefined) {
		tem_line_material.color.setHex( highlightColors[name] );
		if (bundleBrush['track' + name].brushOn) {
			tem_line_material.color.setHex( 0x000000 );
		}
		bundle.material = tem_line_material;
		return renderer.render(scene, camera);
	}
}

// var $window = $(window),
//    $stickyEl = $('#statcontent'),
//    elTop = $stickyEl.offset().top;

// $window.scroll(function() {
//     $stickyEl.toggleClass('sticky', $window.scrollTop() > elTop);
// });
