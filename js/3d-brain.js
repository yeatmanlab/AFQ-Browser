// =========== three js part

var camera, scene, renderer;
var directionalLight;

var brain;
var lh, rh;

var colorGroups = new THREE.Object3D();
var greyGroups = new THREE.Object3D();

// Set initial opacitites here
var initLHOpacity = 0.01;
var initRHOpacity = 0.70;
var initFiberOpacity = 0.25;
var initColorOpacity = 0.75;
var initHighlightOpacity = 0.75;

// Set initial line widths here
var initFiberLineWidth = 1.0;
var initColorLineWidth = 2.0;
var initHighlightLineWidth = 2.5;

// var mouseoverHighlight = true

var guiConfigObj = function () {
	this.lhOpacity = initLHOpacity;
	this.rhOpacity = initRHOpacity;
	this.fiberOpacity = initFiberOpacity;
	this.highlight = true;
};

var gui = new dat.GUI({
	autoplace: false,
	width: 250,
	scrollable: false
});

var controlBox = new guiConfigObj();

var greyLineMaterial = new THREE.LineBasicMaterial({
	opacity: initFiberOpacity,
	linewidth: initFiberLineWidth,
	transparent: true,
	depthWrite: true
});

greyLineMaterial.color.setHex( 0x444444 );

var colorLineMaterial = new THREE.LineBasicMaterial({
	opacity: 0.0,
	linewidth: 0.000000000001,
    transparent: true,
	depthWrite: false
});

// init requires faPlotLength to be defined. faPlotLength is defined in
// buildTractCheckboxes in tract-details.js but it is async, deferred until
// d3 reads nodes.csv. So we have to wait until faPlotLength is defined
// Define a function to wait until faPlotLength is defined.
function waitForPlotLength(callback) {
	if (faPlotLength == undefined) {
		setTimeout(function() {
			console.log("waiting for plot length");
			waitForPlotLength(callback);
		}, 250);
	} else {
		callback(null);
	}
}

// Combine the init and animate function calls for use in d3.queue()
function initAndAnimate(error) {
	init();
	animate();
}

// Use d3.queue() to wait for faPlotLength before calling init and animate
var threeQ = d3_queue.queue();
threeQ.defer(waitForPlotLength);
threeQ.await(initAndAnimate);

var mouseDown = 0;
var mouseMove = false;
document.body.onmousedown = function() {
  ++mouseDown;
}
document.body.onmouseup = function() {
  --mouseDown;
}

var showStats = false;
var stats;

// We put the renderer inside a div with id #threejsbrain
var container;

if (showStats) {
	stats = new Stats();
	container.appendChild( stats.dom );
}

function init() {
	container = document.getElementById("threejsbrain");

    var width = container.clientWidth;
	var height = container.clientHeight;

    camera = new THREE.PerspectiveCamera( 45, width / height, 1, 2000 );
    camera.position.x = -15;
	camera.up.set(0, 0, 1);

    // scene
    scene = new THREE.Scene();

    var ambient = new THREE.AmbientLight(0x111111);
    scene.add(ambient);

    directionalLight = new THREE.DirectionalLight(0xffeedd, 1);
    directionalLight.position.set(
			camera.position.x,
			camera.position.y,
			camera.position.z);
    scene.add(directionalLight);

    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        //console.log(item, loaded, total);
    };

    // renderer
    renderer = new THREE.WebGLRenderer({ alpha: true });

    renderer.setSize(width, height);
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
                child.material.depthWrite = true;
                child.material.transparent = true;

				child.rotation.x = Math.PI / 2;
				child.scale.set(1.75, 1.75, 1.75);
				child.renderOrder = 3;
            }
        });
		lh.translateX(-0.05);
		rh.translateX( 0.05);

        lh.material.opacity = initLHOpacity;
        rh.material.opacity = initRHOpacity;

		lh.material.color.setHex( 0xe8e3d3 );
		rh.material.color.setHex( 0xe8e3d3 );

        scene.add(object);
    });

	var lhOpacityController = gui.add(controlBox, 'lhOpacity')
		.min(0).max(1).step(0.01).name('Left Hemi Opacity');

	lhOpacityController.onChange( function(value) {
		lh.traverse(function (child) {
			if (child instanceof THREE.Mesh) {
				child.material.opacity = value;
			}
		})
	});

	var rhOpacityController = gui.add(controlBox, 'rhOpacity')
		.min(0).max(1).step(0.01).name('Right Hemi Opacity');

	rhOpacityController.onChange( function(value) {
		rh.traverse(function (child) {
			if (child instanceof THREE.Mesh) {
				child.material.opacity = value;
			}
		})
	});

	var fiberOpacityController = gui.add(controlBox, 'fiberOpacity')
		.min(0).max(1).name('Fiber Opacity');

	fiberOpacityController.onChange( function(value) {
        greyGroups.traverse(function (child) {
			if (child instanceof THREE.LineSegments) {
                child.material.opacity = value;
				if (value === 0) {
					child.material.depthWrite = false;
				} else {
					child.material.depthWrite = true;
				}
			}
		})
	});

	var highlightController = gui.add(controlBox, 'highlight')
		.name('Mouseover Highlight');

	highlightController.onChange( function(value) {
		console.log(value);
	});

	var guiContainer = document.getElementById('three-gui-container');
	guiContainer.appendChild(gui.domElement);
	gui.close();

    // contain all bundles in this Group object
    // each bundle is represented by an Object3D
    // load fiber bundle using jQuery
	var greyGeometry = new THREE.Geometry();

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
							var errMessage = 'Streamlines have unexpected length. faPlotLength = ' + faPlotLength + ", but oneFiber.length = " + oneFiber.length;
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

				greyGeometry.merge(
						new THREE.Geometry()
						.fromBufferGeometry(bundleGeometry));

				var colorBundleLine = new THREE.LineSegments(bundleGeometry,
						colorLineMaterial);

				// Set scale to match the brain surface,
				// (determined by trial and error)
				colorBundleLine.scale.set(0.05,0.05,0.05);
                colorBundleLine.position.set(0, 0.8, -0.5);

				// Record some useful info for later
				colorBundleLine.name = tracts[ bundleIdx ];
				colorBundleLine.nFibers = nFibers;
				colorBundleLine.idx = bundleIdx;

				++bundleIdx;

                colorGroups.add(colorBundleLine);
            }
        }

		// Set material properties for each fiber bundle
		// And add event listeners for mouseover, etc.
        colorGroups.traverse(function (child) {
			if (child instanceof THREE.LineSegments) {
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
								var myBundle = d3.selectAll("input.tracts")[0][child.idx];
								myBundle.checked = !myBundle.checked;
								showHideTractDetails(myBundle.checked, myBundle.name)
								highlightBundle(myBundle.checked, myBundle.name)
								return renderer.render(scene, camera);
							} else {
								mouseMove = false;
							}
						});
                domEvents.addEventListener(child, 'mouseout', function(event) {
        					var myBundle = d3.selectAll("input.tracts")[0][child.idx];
        					showHideTractDetails(myBundle.checked, myBundle.name)
        					highlightBundle(myBundle.checked, myBundle.name)
        					return renderer.render(scene, camera);
                });
            }
        });

		var greyBundleLine = new THREE.LineSegments(
				greyGeometry, greyLineMaterial);
		greyBundleLine.scale.set(0.05,0.05,0.05);
        greyBundleLine.position.set(0, 0.8, -0.5);

		greyGroups.add(greyBundleLine);

		greyGroups.renderOrder = 1;
		colorGroups.renderOrder = 2;

		// Finally add fiber bundle group to the scene.
  		scene.add(colorGroups);
		scene.add(greyGroups);
    });

    window.addEventListener('resize', onWindowResize, false);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', lightUpdate);
    controls.enableKeys = false;
}

// Resize the three.js window on full window resize.
function onWindowResize() {
    var width = container.clientWidth;
	var height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
	if (showStats)
		stats.update();

	// For each fiber bundle update the length of fiber to be plotted
	// based on the d3 brushes in the FA plots
	for (var i = 0; i < colorGroups.children.length; i++) {
		var tract = 'tract' + i;
		var lo = Math.floor(bundleBrush[tract].brushExtent[0]);
		var hi = Math.ceil(bundleBrush[tract].brushExtent[1]) - 1;

		// loIdx is the low index and count is the number of indices
		// This is a little sloppy and sometimes the count will be too high
		// but the visual offset should be minimal.
		// TODO: Positions come in pairs, with all vertices except the first
		// and last being repeated. Take this into account to make loIdx and
		// count correct (not just good enough).
		var loIdx = lo * colorGroups.children[i].nFibers * 2;
		var count = (hi - lo) * colorGroups.children[i].nFibers * 2;

		// Set the drawing range based on the brush extent.
		colorGroups.children[i].geometry.setDrawRange(loIdx, count);
	}
}

function lightUpdate() {
    directionalLight.position.copy(camera.position);
}

// Highlight specified bundle based on left panel checkboxes
function highlightBundle(state, name) {

	// Temporary line material for highlighted bundles
	var tmpLineMaterial = new THREE.LineBasicMaterial({
		opacity: initColorOpacity,
		linewidth: initColorLineWidth,
		transparent: true,
		depthWrite: true
	});

	bundle = colorGroups.children[name];

	if (bundle !== undefined) {
		if (state === true) {
			tmpLineMaterial.color.setHex( colors[name] );
			bundle.material = tmpLineMaterial;
			return renderer.render(scene, camera);

		} else {
			bundle.material = colorLineMaterial;
			return renderer.render(scene, camera);
		}
	}
}

// Highlight specified bundle based on mouseover
function mouseoverBundle(name) {
	if (controlBox.highlight) {
		// Temporary line material for moused-over bundles
		var tmpLineMaterial = new THREE.LineBasicMaterial({
			opacity: initHighlightOpacity,
			linewidth: initHighlightLineWidth,
			transparent: true
		});

		bundle = colorGroups.children[name];

		if (bundle !== undefined) {
			tmpLineMaterial.color.setHex( highlightColors[name] );
			if (bundleBrush['tract' + name].brushOn) {
				tmpLineMaterial.color.setHex( 0x000000 );
			}
			bundle.material = tmpLineMaterial;
			return renderer.render(scene, camera);
		}
	}
}

// var $window = $(window),
//    $stickyEl = $('#statcontent'),
//    elTop = $stickyEl.offset().top;

// $window.scroll(function() {
//     $stickyEl.toggleClass('sticky', $window.scrollTop() > elTop);
// });
