// Tell jslint that certain variables are global
/* global afqb, THREE, THREEx, dat, d3, d3_queue, Stats, $, Float32Array */

// =========== three js part
// Set initial opacitites here
//afqb.three.settings.lHOpacity = 0.01;
//afqb.three.settings.rHOpacity = 0.70;
//afqb.three.settings.fiberOpacity = 0.25;
//afqb.three.settings.colorOpacity = 0.75;
//afqb.three.settings.highlightOpacity = 0.75;

// Set initial line widths here
//afqb.three.settings.fiberLineWidth = 1.0;
//afqb.three.settings.colorLineWidth = 2.0;
//afqb.three.settings.highlightLineWidth = 2.5;

// Set boolean value to show rendering stats
//afqb.three.settings.showStats = false;

// Set the initial camera position
//afqb.three.settings.cameraPosition = {
//	x: -15,
//	y: 0,
//	z: 0
//};

// init requires afqb.plots.faPlotLength to be defined.
// afqb.plots.faPlotLength is defined in afqb.plots.buildTractCheckboxes in
// tract-details.js but it is async, deferred until d3 reads nodes.csv.
// So we have to wait until afqb.plots.faPlotLength is defined
// Define a function to wait until afqb.plots.faPlotLength is defined.
afqb.three.waitForPlotLength = function (callback) {
	"use strict";
    if (afqb.plots.faPlotLength === undefined) {
		setTimeout(function () {
			console.log("waiting for plot length");
			afqb.three.waitForPlotLength(callback);
		}, 250);
	} else {
		callback(null);
	}
};

// Combine the init and animate function calls for use in d3.queue()
afqb.three.initAndAnimate = function (error) {
    "use strict";
    if (error) { throw error; }
    afqb.three.init();
	afqb.three.animate();
};

afqb.three.stats = {};

if (afqb.three.settings.showStats) {
	afqb.three.stats = new Stats();
	afqb.three.container.appendChild(afqb.three.stats.dom);
}

afqb.three.init = function () {
    "use strict";
    afqb.three.colorGroups = new THREE.Object3D();
    afqb.three.greyGroups = new THREE.Object3D();

    afqb.three.greyLineMaterial = new THREE.LineBasicMaterial({
        opacity: afqb.three.settings.fiberOpacity,
        linewidth: afqb.three.settings.fiberLineWidth,
        transparent: true,
        depthWrite: true
    });

    afqb.three.greyLineMaterial.color.setHex(0x444444);

    afqb.three.colorLineMaterial = new THREE.LineBasicMaterial({
        opacity: 0.0,
        linewidth: 0.000000000001,
        transparent: true,
        depthWrite: false
    });

	// We put the renderer inside a div with id #threejsbrain
	afqb.three.container = document.getElementById("threejsbrain");

    var width = afqb.three.container.clientWidth;
	var height = afqb.three.container.clientHeight;

    afqb.three.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    afqb.three.camera.position.copy(new THREE.Vector3(
        afqb.three.settings.cameraPosition.x,
        afqb.three.settings.cameraPosition.y,
        afqb.three.settings.cameraPosition.z
    ));

	afqb.three.camera.up.set(0, 0, 1);

    // scene
    afqb.three.scene = new THREE.Scene();

    var ambient = new THREE.AmbientLight(0x111111);
    afqb.three.scene.add(ambient);

    afqb.three.directionalLight = new THREE.DirectionalLight(0xffeedd, 1);
    afqb.three.directionalLight.position.set(
		afqb.three.camera.position.x,
		afqb.three.camera.position.y,
		afqb.three.camera.position.z
    );
    afqb.three.scene.add(afqb.three.directionalLight);

    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        // console.log(item, loaded, total);
    };

    // renderer
    afqb.three.renderer = new THREE.WebGLRenderer({ alpha: true });

    afqb.three.renderer.setSize(width, height);
    afqb.three.container.appendChild(afqb.three.renderer.domElement);

    // dom event
    var domEvents = new THREEx.DomEvents(afqb.three.camera, afqb.three.renderer.domElement);

    // model
    // load brain surface
    var loader = new THREE.OBJLoader(manager);
    loader.load('data/freesurf.OBJ', function (object) {
        afqb.three.brain = object;
        afqb.three.rh = object.getObjectByName('rh.pial.asc');
        afqb.three.lh = object.getObjectByName('lh.pial.asc');

        object.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material.depthWrite = true;
                child.material.transparent = true;

				child.rotation.x = Math.PI / 2;
				child.scale.set(1.75, 1.75, 1.75);
				child.renderOrder = 3;
            }
        });
		afqb.three.lh.translateX(-0.05);
		afqb.three.rh.translateX(0.05);

        afqb.three.lh.material.opacity = afqb.three.settings.lHOpacity;
        afqb.three.rh.material.opacity = afqb.three.settings.rHOpacity;

		afqb.three.lh.material.color.setHex(0xe8e3d3);
		afqb.three.rh.material.color.setHex(0xe8e3d3);

        afqb.three.scene.add(object);
    });

	var ThreeGuiConfigObj = function () {
		this.lhOpacity = afqb.three.settings.lHOpacity;
		this.rhOpacity = afqb.three.settings.rHOpacity;
		this.fiberOpacity = afqb.three.settings.fiberOpacity;
		this.highlight = true;
	};

	afqb.three.gui = new dat.GUI({
		autoplace: false,
		width: 250,
		scrollable: false
	});

	afqb.global.controls.threeControlBox = new ThreeGuiConfigObj();

	var lhOpacityController = afqb.three.gui
		.add(afqb.global.controls.threeControlBox, 'lhOpacity')
		.min(0).max(1).step(0.01).name('Left Hemi Opacity');

	lhOpacityController.onChange(function (value) {
		afqb.three.lh.traverse(function (child) {
			if (child instanceof THREE.Mesh) {
				child.material.opacity = value;
			}
		});
	});

	var rhOpacityController = afqb.three.gui
		.add(afqb.global.controls.threeControlBox, 'rhOpacity')
		.min(0).max(1).step(0.01).name('Right Hemi Opacity');

	rhOpacityController.onChange(function (value) {
		afqb.three.rh.traverse(function (child) {
			if (child instanceof THREE.Mesh) {
				child.material.opacity = value;
			}
		});
	});

	var fiberOpacityController = afqb.three.gui
		.add(afqb.global.controls.threeControlBox, 'fiberOpacity')
		.min(0).max(1).name('Fiber Opacity');

	fiberOpacityController.onChange(function (value) {
        afqb.three.greyGroups.traverse(function (child) {
			if (child instanceof THREE.LineSegments) {
                child.material.opacity = value;
				if (value === 0) {
					child.material.depthWrite = false;
				} else {
					child.material.depthWrite = true;
				}
			}
		});
	});

    // Add highlight controller
	afqb.three.gui
		.add(afqb.global.controls.threeControlBox, 'highlight')
		.name('Mouseover Highlight');

	var guiContainer = document.getElementById('three-gui-container');
	guiContainer.appendChild(afqb.three.gui.domElement);
	afqb.three.gui.close();

    // contain all bundles in this Group object
    // each bundle is represented by an Object3D
    // load fiber bundle using jQuery
	var greyGeometry = new THREE.Geometry();

	var bundleIdx = 0;
    $.getJSON("data/data_partial.json", function (json) {
        Object.keys(json).forEach(function (key) {
            var oneBundle = json[key];
            var nFibers = 0;

            // fiberKeys correspond to individual fibers in each fiber bundle
            // They may not be consecutive keys depending on the
            // downsampling of the input data, hence the need for `nFibers`
            // and `iFiber`
            //
            // First loop simply counts the number of fibers in this bundle
            // and asserts that each individual fiber has been resampled to
            // the size of the FA plot data.
            Object.keys(oneBundle).forEach(function (fiberKey) {
                ++nFibers;
                var oneFiber = oneBundle[fiberKey];
                if (oneFiber.length !== afqb.plots.faPlotLength) {
                    var errMessage = 'Streamlines have unexpected length. faPlotLength = ' + afqb.plots.faPlotLength + ", but oneFiber.length = " + oneFiber.length;
                    if (typeof Error !== 'undefined') {
                        throw new Error(errMessage);
                    }
                    throw errMessage;
                }
            });

            // Positions will hold x,y,z vertices for each fiber
            var positions = new Float32Array(
                nFibers * (afqb.plots.faPlotLength - 1) * 3 * 2
            );

            // Outer loop is along the length of each fiber.
            // Inner loop cycles through each fiber group.
            // This is counterintuitive but we want spatial locality to
            // be preserved in index locality. This will make brushing
            // much easier in the end.
            Object.keys(oneBundle).forEach(function (fiberKey, iFiber) {
                for (var i = 0; i < afqb.plots.faPlotLength - 1; i++) {
                    var oneFiber = oneBundle[fiberKey];

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
                }
            });

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
                    afqb.three.colorLineMaterial);

            // Set scale to match the brain surface,
            // (determined by trial and error)
            colorBundleLine.scale.set(0.05,0.05,0.05);
            colorBundleLine.position.set(0, 0.8, -0.5);

            // Record some useful info for later
            colorBundleLine.name = afqb.plots.tracts[ bundleIdx ];
            colorBundleLine.nFibers = nFibers;
            colorBundleLine.idx = bundleIdx;

            ++bundleIdx;

            afqb.three.colorGroups.add(colorBundleLine);
        });

		// Set material properties for each fiber bundle
		// And add event listeners for mouseover, etc.
		afqb.three.colorGroups.traverse(function (child) {
			if (child instanceof THREE.LineSegments) {
				domEvents.addEventListener(child, 'mouseover', function() {
					if(!afqb.global.mouse.isDown) {
						afqb.three.mouseoverBundle(child.idx);
						return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
					}
				});
				domEvents.addEventListener(child, 'mousemove', function() {
					afqb.global.mouse.mouseMove = true;
				});
				domEvents.addEventListener(child, 'mousedown', function() {
					afqb.global.mouse.mouseMove = false;
				});
				domEvents.addEventListener(child, 'mouseup', function() {
					if(!afqb.global.mouse.mouseMove) {
						var myBundle = d3.selectAll("input.tracts")[0][child.idx];
						myBundle.checked = !myBundle.checked;
						afqb.plots.settings.checkboxes[myBundle.name] = myBundle.checked;
						afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
						afqb.three.highlightBundle(myBundle.checked, myBundle.name);
						return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
					} else {
						afqb.global.mouse.mouseMove = false;
					}
				});
				domEvents.addEventListener(child, 'mouseout', function() {
					var myBundle = d3.selectAll("input.tracts")[0][child.idx];
					afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
					afqb.three.highlightBundle(myBundle.checked, myBundle.name);
					return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
				});
            }
        });

		var greyBundleLine = new THREE.LineSegments(
				greyGeometry, afqb.three.greyLineMaterial);
		greyBundleLine.scale.set(0.05,0.05,0.05);
        greyBundleLine.position.set(0, 0.8, -0.5);

		afqb.three.greyGroups.add(greyBundleLine);

		afqb.three.greyGroups.renderOrder = 1;
		afqb.three.colorGroups.renderOrder = 2;

		// Finally add fiber bundle group to the afqb.three.scene.
  		afqb.three.scene.add(afqb.three.colorGroups);
		afqb.three.scene.add(afqb.three.greyGroups);
    });

    window.addEventListener('resize', afqb.three.onWindowResize, false);
    afqb.three.orbitControls = new THREE.OrbitControls(afqb.three.camera, afqb.three.renderer.domElement);
    afqb.three.orbitControls.addEventListener('change', afqb.three.lightUpdate);
    afqb.three.orbitControls.enableKeys = false;
};

// Resize the three.js window on full window resize.
afqb.three.onWindowResize = function () {
    "use strict";
    var width = afqb.three.container.clientWidth;
	var height = afqb.three.container.clientHeight;

    afqb.three.camera.aspect = width / height;
    afqb.three.camera.updateProjectionMatrix();

    afqb.three.renderer.setSize(width, height);
};

afqb.three.animate = function () {
    "use strict";
    requestAnimationFrame(afqb.three.animate);
    afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
    afqb.three.orbitControls.update();
	if (afqb.three.settings.showStats) {
		afqb.three.stats.update();
    }

	// For each fiber bundle update the length of fiber to be plotted
	// based on the d3 brushes in the FA plots
	for (var i = 0; i < afqb.three.colorGroups.children.length; i++) {
		var tract = 'tract' + i;
		var lo = Math.floor(afqb.plots.settings.bundleBrush[tract].brushExtent[0]);
		var hi = Math.ceil(afqb.plots.settings.bundleBrush[tract].brushExtent[1]) - 1;

		// loIdx is the low index and count is the number of indices
		// This is a little sloppy and sometimes the count will be too high
		// but the visual offset should be minimal.
		// TODO: Positions come in pairs, with all vertices except the first
		// and last being repeated. Take this into account to make loIdx and
		// count correct (not just good enough).
		var loIdx = lo * afqb.three.colorGroups.children[i].nFibers * 2;
		var count = (hi - lo) * afqb.three.colorGroups.children[i].nFibers * 2;

		// Set the drawing range based on the brush extent.
		afqb.three.colorGroups.children[i].geometry.setDrawRange(loIdx, count);
	}
};

afqb.three.lightUpdate = function () {
    "use strict";
    afqb.three.directionalLight.position.copy(afqb.three.camera.position);
};

// Highlight specified bundle based on left panel checkboxes
afqb.three.highlightBundle = function (state, name) {
    "use strict";

	// Temporary line material for highlighted bundles
	var tmpLineMaterial = new THREE.LineBasicMaterial({
		opacity: afqb.three.settings.colorOpacity,
		linewidth: afqb.three.settings.colorLineWidth,
		transparent: true,
		depthWrite: true
	});

	var bundle = afqb.three.colorGroups.children[name];

	if (bundle !== undefined) {
		if (state === true) {
			tmpLineMaterial.color.setHex( afqb.global.colors[name] );
			bundle.material = tmpLineMaterial;
			return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);

		} else {
			bundle.material = afqb.three.colorLineMaterial;
			return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
		}
	}
};

// Highlight specified bundle based on mouseover
afqb.three.mouseoverBundle = function (name) {
    "use strict";
	if (afqb.global.controls.threeControlBox.highlight) {
		// Temporary line material for moused-over bundles
		var tmpLineMaterial = new THREE.LineBasicMaterial({
			opacity: afqb.three.settings.highlightOpacity,
			linewidth: afqb.three.settings.highlightLineWidth,
			transparent: true
		});

		var bundle = afqb.three.colorGroups.children[name];

		if (bundle !== undefined) {
			tmpLineMaterial.color.setHex( afqb.global.highlightColors[name] );
			if (afqb.plots.settings.bundleBrush['tract' + name].brushOn) {
				tmpLineMaterial.color.setHex( 0x000000 );
			}
			bundle.material = tmpLineMaterial;
			return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
		}
	}
};

// Use d3.queue() to wait for afqb.plots.faPlotLength before calling init and animate
afqb.global.queues.threeQ = d3_queue.queue();
afqb.global.queues.threeQ.defer(afqb.global.waitForSettings);
afqb.global.queues.threeQ.defer(afqb.three.waitForPlotLength);
afqb.global.queues.threeQ.await(afqb.three.initAndAnimate);


// var $window = $(window),
//    $stickyEl = $('#statcontent'),
//    elTop = $stickyEl.offset().top;

// $window.scroll(function() {
//     $stickyEl.toggleClass('sticky', $window.scrollTop() > elTop);
// });
