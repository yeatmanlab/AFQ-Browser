// Tell jslint that certain variables are global
/* global afqb, THREE, THREEx, dat, d3, Stats, $, Float32Array */

// =========== three js part

/**
 * Combine the init and animate function calls for use in d3.queue()
 *
 * @param error - error passed through from previous function in d3.queue()
 */
afqb.three.initAndAnimate = function (error) {
    "use strict";
    if (error) { throw error; }
    afqb.three.init(afqb.plots.initCheckboxes);
	afqb.three.animate();
};

/**
 * Build the dat.gui controls for the anatomy panel
 *
 * @param streamlinesExist - boolean to indicate existence of anatomy streamlines.
 * if streamlinesExist is true, then the fiberRepesentation controller will allow
 * both 'core fiber' and 'all fibers' options. Otherwise, only 'core fiber' will
 * be allowed.
 */
afqb.three.buildthreeGui = function (streamlinesExist) {
    var ThreeGuiConfigObj = function () {
        this.lhOpacity = parseFloat(afqb.three.settings.lHOpacity);
        this.rhOpacity = parseFloat(afqb.three.settings.rHOpacity);
        this.fiberOpacity = parseFloat(afqb.three.settings.fiberOpacity);
        this.highlight = afqb.three.settings.mouseoverHighlight;
        this.fiberRepresentation = streamlinesExist ? afqb.three.settings.fiberRepresentation : 'core fiber';
    };

    afqb.three.gui = new dat.GUI({
        autoplace: false,
        width: 350,
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

    lhOpacityController.onFinishChange(function (value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {lHOpacity: value.toString()}}
        );
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

    rhOpacityController.onFinishChange(function (value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {rHOpacity: value.toString()}}
        );
    });

    var fiberOpacityController = afqb.three.gui
        .add(afqb.global.controls.threeControlBox, 'fiberOpacity')
        .min(0.0).max(1.0).step(0.01).name('Fiber Opacity');

    fiberOpacityController.onChange(function (value) {
        afqb.three.greyGroup.traverse(function (child) {
            if (child instanceof THREE.LineSegments) {
                child.material.opacity = value;
                if (value === 0) {
                    child.material.depthWrite = false;
                } else {
                    child.material.depthWrite = true;
                }
            }
        });

        afqb.three.greyCoreGroup.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material.opacity = value;
                if (value === 0) {
                    child.material.depthWrite = false;
                } else {
                    child.material.depthWrite = true;
                }
            }
        });
    });

    fiberOpacityController.onFinishChange(function (value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {fiberOpacity: value.toString()}}
        );
    });

    // Add highlight controller
    var mouseoverHighlightController = afqb.three.gui
        .add(afqb.global.controls.threeControlBox, 'highlight')
        .name('Mouseover Highlight');

    mouseoverHighlightController.onFinishChange(function (value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {mouseoverHighlight: value.toString()}}
        );
    });

    // Add fiber representation controller
    var fiberRepController;
    if (streamlinesExist) {
        // Allow both options: 'core fiber' and 'all fibers'
        fiberRepController = afqb.three.gui
            .add(afqb.global.controls.threeControlBox, 'fiberRepresentation', ['all fibers', 'core fiber'])
            .name('Fiber Representation');
    } else {
        // Restrict to only 'core fiber'
        fiberRepController = afqb.three.gui
            .add(afqb.global.controls.threeControlBox, 'fiberRepresentation', ['core fiber'])
            .name('Fiber Representation');
    }

    fiberRepController.onFinishChange(function (value) {
        // Toggle visibility of either core fibers or streamlines
        if (value === "all fibers") {
            afqb.three.colorGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyGroup.traverse(afqb.three.makeVisible);
            afqb.three.convexGroup.traverse(afqb.three.makeVisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeInvisible);
            afqb.three.colorGroup.traverse(function (child) {
                if (child instanceof THREE.LineSegments) {
                    afqb.three.mouseoutBundle(child);
                }
            });
        } else {
            afqb.three.colorGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyGroup.traverse(afqb.three.makeInvisible);
            afqb.three.convexGroup.traverse(afqb.three.makeInvisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeVisible);
            afqb.three.colorCoreGroup.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    afqb.three.mouseoutBundle(child);
                }
            });
        }

        // Update the query string
        afqb.global.updateQueryString(
            {three: {fiberRepresentation: afqb.global.formatKeyName(value)}}
        );

    });

    var guiContainer = document.getElementById('three-gui-container');
    guiContainer.appendChild(afqb.three.gui.domElement);
    afqb.three.gui.close();
};

/**
 * Initialize the three.js scene for subject's anatomy
 *
 * The scene consists of six object groups:
 *
 * - afqb.three.brain: the brain surface, loaded from freesurf.OBJ
 * - afqb.three.colorGroup: fiber bundle streamlines that display when
 *   selected, one object for each bundle
 * - afqb.three.greyGroup: grey fiber bundles that are always displayed
 *   underneath the color ones, all rendered together as one buffer geometry
 * - afqb.three.colorCoreGroup: core fibers that display when selected, one
 *   object per bundle
 * - afqb.three.greyCoreGroup: grey core fibers that are always displayed
 *   underneath the color bundles
 * - afqb.three.convexGroup: invisible convex hulls, one for each streamline
 *   colorGroup. These are never displayed but hold all of the dom events for
 *   the colorGroup objects.
 *
 * @param streamlinesCallback - function to be called after the streamlines
 * have been loaded from streamlines.json
 */
afqb.three.init = function (streamlinesCallback) {
    "use strict";
    // contain all bundles in these Group objects
    afqb.three.colorGroup = new THREE.Group();
    afqb.three.greyGroup = new THREE.Group();
    afqb.three.colorCoreGroup = new THREE.Group();
    afqb.three.greyCoreGroup = new THREE.Group();
    afqb.three.convexGroup = new THREE.Group();

	// We put the renderer inside a div with id #threejsbrain
	afqb.three.container = document.getElementById("threejsbrain");

	// Get width and height
    var width = afqb.three.container.clientWidth;
	var height = afqb.three.container.clientHeight;

	// Show three.js stats if desired
    afqb.three.stats = {};
    if (afqb.three.settings.showStats) {
        afqb.three.stats = new Stats();
        afqb.three.container.appendChild(afqb.three.stats.dom);
    }

    // Set the camera position
    afqb.three.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    afqb.three.camera.position.copy(new THREE.Vector3(
        afqb.three.settings.cameraPosition.x,
        afqb.three.settings.cameraPosition.y,
        afqb.three.settings.cameraPosition.z
    ));
	afqb.three.camera.up.set(0, 0, 1);

    // init scene
    afqb.three.scene = new THREE.Scene();

    // Use ambient light
    var ambient = new THREE.AmbientLight(0x111111);
    afqb.three.scene.add(ambient);

    // And a directional light always pointing from the camera
    afqb.three.directionalLight = new THREE.DirectionalLight(0xffeedd, 1);
    afqb.three.directionalLight.position.set(
		afqb.three.camera.position.x,
		afqb.three.camera.position.y,
		afqb.three.camera.position.z
    );
    afqb.three.scene.add(afqb.three.directionalLight);

    // renderer
    afqb.three.renderer = new THREE.WebGLRenderer({ alpha: true });
    afqb.three.renderer.setSize(width, height);
    afqb.three.container.appendChild(afqb.three.renderer.domElement);

    // Add a mouseout listener for the entire 3D view, that will unhighlight
    // any bundles that didn't have time to register their own mouseout event
    // before the mouse escaped the container.
    afqb.three.renderer.domElement.addEventListener("mouseout", function () {
        var groups = [
            afqb.three.colorGroup, afqb.three.colorCoreGroup,
            afqb.three.greyGroup, afqb.three.greyCoreGroup
        ];
        groups.forEach(function (group) {
            group.traverse(function (child) {
                if (child instanceof THREE.LineSegments || child instanceof THREE.Mesh) {
                    afqb.three.mouseoutBundle(child);
                }
            });
        });
    });

    // model
    // load brain surface using OBJLoader
    var loader = new THREE.OBJLoader();
    loader.load('data/freesurf.OBJ', function (object) {
        afqb.three.brain = object;
        afqb.three.rh = object.getObjectByName('rh.pial.asc');
        afqb.three.lh = object.getObjectByName('lh.pial.asc');

        object.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material.depthWrite = true;
                child.material.transparent = true;

				child.rotation.x = Math.PI / 2;

				// Scale set by trial and error
				child.scale.set(1.75, 1.75, 1.75);

				// Set render order so that it doesn't occlude the
                // fiber bundles underneath when opacity is decreased
				child.renderOrder = 3;
                child.traverse(function (object) {
                    object.renderOrder = 3;
                });
            }
        });

        // Separate the hemispheres a little bit so that depthWrite works as expected.
		afqb.three.lh.translateX(-0.05);
		afqb.three.rh.translateX(0.05);

        afqb.three.lh.material.opacity = afqb.three.settings.lHOpacity;
        afqb.three.rh.material.opacity = afqb.three.settings.rHOpacity;

		afqb.three.lh.material.color.setHex(0xe8e3d3);
		afqb.three.rh.material.color.setHex(0xe8e3d3);

        afqb.three.scene.add(object);
    });

    // init dom events for later
    var domEvents = new THREEx.DomEvents(afqb.three.camera, afqb.three.renderer.domElement);

    // load fiber bundle using jQuery
    $.getJSON("data/streamlines.json", function (json) {
        var names = afqb.plots.tracts.map(function(name) {
            return afqb.global.formatKeyName(name);
        });

        // init streamlinesExist to false and set to true later only if we find them
        var streamlinesExist = false;

        // Iterate through the bundles
        Object.keys(json).forEach(function (bundleKey) {
            var oneBundle = json[bundleKey];

            var keyName = afqb.global.formatKeyName(bundleKey);
            var index = names.indexOf(keyName);

            // Retrieve the core fiber and then delete it from the bundle object
            var coreFiber = oneBundle['coreFiber'];
            delete oneBundle['coreFiber'];

            var corePath = coreFiber.map(function (element) {
                return new THREE.Vector3(element[0], element[1], element[2]);
            });
            var coreCurve = new THREE.CatmullRomCurve3(corePath);
            var coreGeometry = new THREE.TubeBufferGeometry(coreCurve, 100, 2.8, 8, false);

            var greyCoreMaterial = new THREE.MeshBasicMaterial({
                opacity: afqb.three.settings.fiberOpacity,
                transparent: true,
                depthWrite: true
            });

            greyCoreMaterial.color.setHex(0x444444);

            var highlightCoreMaterial = new THREE.MeshBasicMaterial({
                opacity: 1.0, // afqb.three.settings.highlightOpacity,
                transparent: false // true
            });
            highlightCoreMaterial.color.setHex( afqb.global.highlightColors[index] );

            var greyMesh = new THREE.Mesh(coreGeometry, greyCoreMaterial);
            greyMesh.scale.set(0.05,0.05,0.05);
            greyMesh.position.set(0, 0.8, -0.5);

            // Record some useful info for later
            greyMesh.name = keyName;
            greyMesh.defaultMaterial = greyCoreMaterial;
            greyMesh.highlightMaterial = highlightCoreMaterial;

            afqb.three.greyCoreGroup.add(greyMesh);

            var colorCoreMaterial = new THREE.MeshBasicMaterial({
                opacity: afqb.three.settings.colorOpacity,
                transparent: true,
                depthWrite: true
            });
            colorCoreMaterial.color.setHex(afqb.global.colors[index]);

            var tubeSegments = 100;
            var radiusSegments = 8;
            coreGeometry = new THREE.TubeBufferGeometry(coreCurve, tubeSegments, 3, radiusSegments, false);
            var colorMesh = new THREE.Mesh(
                coreGeometry, colorCoreMaterial
            );

            // Set scale to match the brain surface,
            // (determined by trial and error)
            colorMesh.scale.set(0.05,0.05,0.05);
            colorMesh.position.set(0, 0.8, -0.5);

            // Record some useful info for later
            colorMesh.name = keyName;
            colorMesh.geometryLength = 2 * tubeSegments * radiusSegments * 3;
            colorMesh.defaultMaterial = colorCoreMaterial;
            colorMesh.highlightMaterial = highlightCoreMaterial;

            afqb.three.colorCoreGroup.add(colorMesh);

            // Now that we've dealt with the core fibers, see if there's anything
            // left over. If so, these are the streamlines.
            streamlinesExist = !$.isEmptyObject(oneBundle) || streamlinesExist;

            if (streamlinesExist) {
                // fiberKeys correspond to individual fibers in each fiber bundle
                // They may not be consecutive keys depending on the
                // downsampling of the input data, hence the need for `nFibers`
                // and `iFiber`

                // First loop simply counts the number of fibers in this bundle
                // and asserts that each individual fiber has been resampled to
                // the same size.
                var nFibers = 0;
                var firstKey = Object.keys(oneBundle)[0];
                var referenceLength = oneBundle[firstKey].length;
                Object.keys(oneBundle).forEach(function (fiberKey) {
                    ++nFibers;
                    var oneFiber = oneBundle[fiberKey];
                    if (oneFiber.length !== referenceLength) {
                        var errMessage = ('Streamlines have unexpected length. ' +
                            'faPlotLength = ' + referenceLength + ', ' +
                            'but oneFiber.length = ' + oneFiber.length);
                        if (typeof Error !== 'undefined') {
                            throw new Error(errMessage);
                        }
                        throw errMessage;
                    }
                });

                // Positions will hold x,y,z vertices for each fiber
                var positions = new Float32Array(
                    nFibers * (referenceLength - 1) * 3 * 2
                );

                // Outer loop is along the length of each fiber.
                // Inner loop cycles through each fiber group.
                // This is counter-intuitive but we want spatial locality to
                // be preserved in index locality. This will make brushing
                // much easier in the end.
                var points = [];
                Object.keys(oneBundle).forEach(function (fiberKey, iFiber) {
                    var oneFiber = oneBundle[fiberKey];
                    for (var i = 0; i < referenceLength - 1; i++) {
                        // Vertices must be added in pairs. Later a
                        // line segment will be drawn in between each pair.
                        // This requires some repeat values to have a
                        // continuous line but will allow us to avoid
                        // having the beginning and end of the fiber
                        // connect.
                        var offset = i * nFibers * 6 + iFiber * 6;
                        positions.set(oneFiber[i].concat(oneFiber[i + 1]), offset);
                        points.push(new THREE.Vector3(
                            oneFiber[i][0], oneFiber[i][1], oneFiber[i][2]
                        ));
                    }
                });

                // Create a buffered geometry and line segments from these
                // positions. Buffered Geometry is slightly more performant
                // and necessary to interact with d3 brushing later on.
                var bundleGeometry = new THREE.BufferGeometry();
                bundleGeometry.addAttribute(
                    'position', new THREE.BufferAttribute(positions, 3)
                );

                var greyLineMaterial = new THREE.LineBasicMaterial({
                    opacity: afqb.three.settings.fiberOpacity,
                    linewidth: afqb.three.settings.fiberLineWidth,
                    transparent: true,
                    depthWrite: true
                });

                greyLineMaterial.color.setHex(0x444444);

                var highlightLineMaterial = new THREE.LineBasicMaterial({
                    opacity: afqb.three.settings.highlightOpacity,
                    linewidth: afqb.three.settings.highlightLineWidth,
                    transparent: true
                });

                highlightLineMaterial.color.setHex(afqb.global.highlightColors[index]);

                var greyLine = new THREE.LineSegments(bundleGeometry, greyLineMaterial);
                greyLine.scale.set(0.05, 0.05, 0.05);
                greyLine.position.set(0, 0.8, -0.5);

                // Record some useful info for later
                greyLine.name = keyName;
                greyLine.nFibers = nFibers;
                greyLine.defaultMaterial = greyLineMaterial;
                greyLine.highlightMaterial = highlightLineMaterial;

                afqb.three.greyGroup.add(greyLine);

                var colorLineMaterial = new THREE.LineBasicMaterial({
                    opacity: afqb.three.settings.colorOpacity,
                    linewidth: afqb.three.settings.colorLineWidth,
                    transparent: true,
                    depthWrite: true
                });

                colorLineMaterial.color.setHex(afqb.global.colors[index]);

                var colorLine = new THREE.LineSegments(
                    bundleGeometry, colorLineMaterial
                );

                // Set scale to match the brain surface,
                // (determined by trial and error)
                colorLine.scale.set(0.05, 0.05, 0.05);
                colorLine.position.set(0, 0.8, -0.5);

                // Record some useful info for later
                colorLine.name = keyName;
                colorLine.nFibers = nFibers;
                colorLine.defaultMaterial = colorLineMaterial;
                colorLine.highlightMaterial = highlightLineMaterial;

                afqb.three.colorGroup.add(colorLine);

                var convexGeometry = new THREE.ConvexGeometry(points);
                var convexMaterial = new THREE.MeshBasicMaterial({
                    opacity: 0,
                    transparent: true,
                    depthWrite: false
                });
                convexMaterial.color.setHex(afqb.global.colors[index]);
                var convexMesh = new THREE.Mesh(convexGeometry, convexMaterial);
                convexMesh.scale.set(0.05, 0.05, 0.05);
                convexMesh.position.set(0, 0.8, -0.5);
                convexMesh.name = keyName;
                afqb.three.convexGroup.add(convexMesh);
            }
        });

        // Now that we know if there are streamlines, build the control panel
        afqb.three.buildthreeGui(streamlinesExist);

		// And add event listeners for mouseover, etc.
        // First add event listeners to all these groups
        var groups = [
            afqb.three.greyCoreGroup,
            afqb.three.colorCoreGroup,
            afqb.three.convexGroup
        ];

        groups.forEach(function (group) {
            group.traverse(function (child) {
                if (child instanceof THREE.LineSegments || child instanceof THREE.Mesh) {
                    domEvents.addEventListener(child, 'mousemove', function() {
                        afqb.global.mouse.mouseMove = true;
                    });
                    domEvents.addEventListener(child, 'mousedown', function() {
                        afqb.global.mouse.mouseMove = false;
                    });
                    domEvents.addEventListener(child, 'mouseover', function() {
                        if(!afqb.global.mouse.isDown) {
                            afqb.three.mouseoverBundle(child);
                            return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
                        }
                    });
                    domEvents.addEventListener(child, 'mouseout', function() {
                        afqb.three.mouseoutBundle(child);
                        return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
                    });
                    domEvents.addEventListener(child, 'mouseup', function() {
                        if(!afqb.global.mouse.mouseMove) {
                            var myBundle = d3.selectAll("input.tracts").filter(function (d) {
                                return afqb.global.formatKeyName(d) === child.name;
                            })[0][0];
                            myBundle.checked = !myBundle.checked;
                            afqb.plots.settings.checkboxes[myBundle.name] = myBundle.checked;
                            afqb.plots.showHideTractDetails(myBundle.checked, myBundle.name);
                            afqb.three.highlightBundle(myBundle.checked, myBundle.name);

                            // Update the query string
                            var checkboxes = {};
                            checkboxes[myBundle.name] = myBundle.checked;
                            afqb.global.updateQueryString(
                                {plots: {checkboxes: checkboxes}}
                            );

                            return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
                        } else {
                            afqb.global.mouse.mouseMove = false;
                        }
                    });
                }
            });
        });

        // Fix the render orders for each group
        // render orders should satisfy
        // surface > grey stuff > color stuff
        afqb.three.greyCoreGroup.renderOrder = 2;
        afqb.three.greyCoreGroup.traverse(function (object) {
            object.renderOrder = 2;
        });

        afqb.three.greyGroup.renderOrder = 2;
        afqb.three.greyGroup.traverse(function (object) {
            object.renderOrder = 2;
        });

        afqb.three.colorCoreGroup.renderOrder = 1;
        afqb.three.colorCoreGroup.traverse(function (object) {
            object.renderOrder = 1;
        });

        afqb.three.colorGroup.renderOrder = 1;
        afqb.three.colorGroup.traverse(function (object) {
            object.renderOrder = 1;
        });

        // Set the initial visibility based on the dat.gui control
        if (afqb.global.controls.threeControlBox.fiberRepresentation === "all fibers") {
            afqb.three.colorGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyGroup.traverse(afqb.three.makeVisible);
            afqb.three.convexGroup.traverse(afqb.three.makeVisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeInvisible);
        } else {
            afqb.three.colorGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyGroup.traverse(afqb.three.makeInvisible);
            afqb.three.convexGroup.traverse(afqb.three.makeInvisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeVisible);
        }

		// Finally add fiber bundle group to the afqb.three.scene.
  		afqb.three.scene.add(afqb.three.colorGroup);
		afqb.three.scene.add(afqb.three.greyGroup);
        afqb.three.scene.add(afqb.three.colorCoreGroup);
        afqb.three.scene.add(afqb.three.greyCoreGroup);
        afqb.three.scene.add(afqb.three.convexGroup);

        // Use the callback function
        if (streamlinesCallback) { streamlinesCallback(null); }

        // Restore brushing if refreshing from a querystring
        afqb.three.brushOn3D();
    });

    // Add a window resize event listener
    window.addEventListener('resize', afqb.three.onWindowResize, false);

    // Add orbit controls (disabling keys and updating lighting when the camera moves)
    afqb.three.orbitControls = new THREE.OrbitControls(afqb.three.camera, afqb.three.renderer.domElement);
    afqb.three.orbitControls.addEventListener('change', afqb.three.lightUpdate);
    afqb.three.orbitControls.enableKeys = false;

    // We want to update the camera position in the querystring but only when
    // the user is done moving the camera, so attach this to the 'click' event
    // listener
    afqb.three.renderer.domElement.addEventListener('click', function() {
		// Update the query string
		var cameraPosition = afqb.three.camera.position.clone();
        afqb.global.updateQueryString(
            {three: {cameraPosition: cameraPosition}}
        );
    }, false);
};

/**
 * Resize the three.js window on full window resize.
 */
afqb.three.onWindowResize = function () {
    "use strict";
    var width = afqb.three.container.clientWidth;
	var height = afqb.three.container.clientHeight;

    afqb.three.camera.aspect = width / height;
    afqb.three.camera.updateProjectionMatrix();

    afqb.three.renderer.setSize(width, height);
};

/**
 * Define how the scene should update after init.
 *
 * Pretty standard here: request animation frame, render, update camera,
 * update stats if desired. If brushing, use afqb.three.brushOn3D to
 * change the drawRange of color objects.
 */
afqb.three.animate = function () {
    "use strict";
    requestAnimationFrame(afqb.three.animate);
    afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
    afqb.three.orbitControls.update();
	if (afqb.three.settings.showStats) {
		afqb.three.stats.update();
    }

    if (afqb.global.mouse.brushing) {
        afqb.three.brushOn3D();
    }
};

/**
 * Update the drawRange of each fiber bundle based on the d3 brushes in the
 * 2D plots panel.
 */
afqb.three.brushOn3D = function () {
    afqb.three.colorGroup.children.forEach(function (element) {
        // Get the extent of the brushes for this bundle
        var lo = Math.floor(afqb.plots.settings.brushes[element.name].brushExtent[0]);
        var hi = Math.ceil(afqb.plots.settings.brushes[element.name].brushExtent[1]) - 1;

        // loIdx is the low index and count is the number of indices
        // This is a little sloppy and sometimes the count will be too high
        // but the visual offset should be minimal.
        // TODO: Positions come in pairs, with all vertices except the first
        // and last being repeated. Take this into account to make loIdx and
        // count correct (not just good enough).
        var loIdx = lo * element.nFibers * 2;
        var count = (hi - lo) * element.nFibers * 2;

        // Set the drawing range based on the brush extent.
        if (afqb.global.controls.plotsControlBox.brushTract) {
            element.geometry.setDrawRange(loIdx, count);
        } else {
            element.geometry.setDrawRange(0, Infinity);
        }
    });

    afqb.three.colorCoreGroup.children.forEach(function (element) {
        // Get the extent of the brushes for this bundle
        var lo = Math.floor(afqb.plots.settings.brushes[element.name].brushExtent[0]);
        var hi = Math.ceil(afqb.plots.settings.brushes[element.name].brushExtent[1]);

        // loIdx is the low index and count is the number of indices
        var totalLength = element.geometryLength;

        // loIdx should be the nearest multiple of 3
        var loIdx = Math.floor(lo * totalLength / 100.0 / 3) * 3;
        var count = parseInt((hi - lo) * totalLength / 100.0);

        // Set the drawing range based on the brush extent.
        if (afqb.global.controls.plotsControlBox.brushTract) {
            element.geometry.setDrawRange(loIdx, count);
        } else {
            element.geometry.setDrawRange(0, Infinity);
        }
    });
};

/**
 * Update the directional light to always point from camera
 */
afqb.three.lightUpdate = function () {
    "use strict";
    afqb.three.directionalLight.position.copy(afqb.three.camera.position);
};


/**
 * Visibility toggle function to show/hide core fibers vs streamlines
 *
 * @param {object} object - the object to show
 */
afqb.three.makeVisible = function (object) {
    object.visible = true;
};


/**
 * Visibility toggle function to show/hide core fibers vs streamlines
 *
 * @param {object} object - the object to hide
 */
afqb.three.makeInvisible = function (object) {
    object.visible = false;
};

/**
 * Highlight specified bundle based on left panel checkboxes
 * If state is checked, show the color group and hide the grey group
 *
 * @param {string} state - checkbox state, checked or unchecked
 * @param {string} name - formatted bundle name
 */
afqb.three.highlightBundle = function (state, name) {
    "use strict";
    var groups = [afqb.three.colorGroup, afqb.three.colorCoreGroup];
    groups.forEach(function (group) {
        // Get the bundle corresponding to this name
        var bundle = group.children.filter(function (element) {
            return element.name === name;
        })[0];

        // Toggle visibility
        if (bundle !== undefined) {
            if (state) {
                bundle.traverse(afqb.three.makeVisible)
            } else {
                bundle.traverse(afqb.three.makeInvisible)
            }
        }
    });

    var groups = [afqb.three.greyGroup, afqb.three.greyCoreGroup];
    groups.forEach(function (group) {
        // Get the bundle corresponding to this name
        var bundle = group.children.filter(function (element) {
            return element.name === name;
        })[0];

        // Toggle visibility
        if (bundle !== undefined) {
            if (state) {
                bundle.traverse(afqb.three.makeInvisible)
            } else {
                bundle.traverse(afqb.three.makeVisible)
            }
        }
    });

    // Render again
    return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
};

/**
 * Restore bundle to original state (checked or unchecked) after mouseout
 *
 * @param {string} child - the child object (i.e. bundle) in some group
 */
afqb.three.mouseoutBundle = function (child) {
    // Specify streamline groups or core fiber groups depending on the
    // dat.gui controls
    if (afqb.global.controls.threeControlBox.fiberRepresentation === 'all fibers') {
        var groups = [afqb.three.colorGroup, afqb.three.greyGroup];
    } else {
        var groups = [afqb.three.colorCoreGroup, afqb.three.greyCoreGroup];
    }

    groups.forEach(function (group) {
        // Get the bundle corresponding to this child.name
        var bundle = group.children.filter(function (element) {
            return element.name === child.name;
        })[0];

        // Restore the material back to the default
        if (bundle !== undefined) {
            bundle.material = bundle.defaultMaterial;
        }
    });

    // Get the checkbox list bundle info from the child name
    var myBundle = d3.selectAll("input.tracts").filter(function (d) {
        return afqb.global.formatKeyName(d) === child.name;
    })[0][0];

    // Restore highlighted state based on the checkbox.
    // Rendering is taken care of inside this function.
    afqb.three.highlightBundle(myBundle.checked, myBundle.name);
};

/**
 * Highlight specified bundle based on mouseover
 *
 * @param {string} child - the child object (i.e. bundle) in some group
 */
afqb.three.mouseoverBundle = function (child) {
    "use strict";
	if (afqb.global.controls.threeControlBox.highlight) {
	    // Specify streamline groups or core fiber groups depending on the
        // dat.gui controls
	    if (afqb.global.controls.threeControlBox.fiberRepresentation === 'all fibers') {
            var groups = [afqb.three.colorGroup, afqb.three.greyGroup];
        } else {
            var groups = [afqb.three.colorCoreGroup, afqb.three.greyCoreGroup];
        }

        groups.forEach(function (group) {
            // Get the bundle corresponding to this child.name
            var bundle = group.children.filter(function (element) {
                return element.name === child.name;
            })[0];

            // Change the material to the highlight material
            if (bundle !== undefined) {
                bundle.material = bundle.highlightMaterial;
            }
        });

	    // Render scene
        return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
	}
};
