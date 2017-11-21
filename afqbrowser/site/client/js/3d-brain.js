// Tell jslint that certain variables are global
/* global afqb, THREE, THREEx, dat, d3, d3_queue, Stats, $, Float32Array */

// =========== three js part

// Combine the init and animate function calls for use in d3.queue()
afqb.three.initAndAnimate = function (error) {
    "use strict";
    if (error) { throw error; }
    afqb.three.init(afqb.plots.initCheckboxes);
	afqb.three.animate();
};

afqb.three.stats = {};

if (afqb.three.settings.showStats) {
	afqb.three.stats = new Stats();
	afqb.three.container.appendChild(afqb.three.stats.dom);
}

afqb.three.init = function (callback) {
    "use strict";
    afqb.three.colorGroup = new THREE.Group();
    afqb.three.greyGroup = new THREE.Group();
    afqb.three.colorCoreGroup = new THREE.Group();
    afqb.three.greyCoreGroup = new THREE.Group();

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

    afqb.three.greyCoreMaterial = new THREE.MeshBasicMaterial({
        opacity: afqb.three.settings.fiberOpacity,
        transparent: true,
        depthWrite: true
    });

    afqb.three.greyCoreMaterial.color.setHex(0x444444);

    afqb.three.colorCoreMaterial = new THREE.MeshBasicMaterial({
        opacity: 0.0,
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

    afqb.three.renderer.domElement.addEventListener("mouseout", function () {
        afqb.three.colorGroup.traverse(function (child) {
            if (child instanceof THREE.LineSegments) {
                afqb.three.mouseoutBundle(child.name);
            }
        });
    });

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
		this.lhOpacity = parseFloat(afqb.three.settings.lHOpacity);
		this.rhOpacity = parseFloat(afqb.three.settings.rHOpacity);
		this.fiberOpacity = parseFloat(afqb.three.settings.fiberOpacity);
		this.highlight = afqb.three.settings.mouseoverHighlight;
		this.fiberRepresentation = afqb.three.settings.fiberRepresentation;
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

    lhOpacityController.onFinishChange(function(value) {
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

    rhOpacityController.onFinishChange(function(value) {
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

    fiberOpacityController.onFinishChange(function(value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {fiberOpacity: value.toString()}}
        );
    });

    // Add highlight controller
	var mouseoverHighlightController = afqb.three.gui
		.add(afqb.global.controls.threeControlBox, 'highlight')
		.name('Mouseover Highlight');

	mouseoverHighlightController.onFinishChange(function(value) {
        // Update the query string
        afqb.global.updateQueryString(
            {three: {mouseoverHighlight: value.toString()}}
        );
	});

    // Add fiber representation controller
    var fiberRepController = afqb.three.gui
        .add(afqb.global.controls.threeControlBox, 'fiberRepresentation', ['all fibers', 'core fiber'])
        .name('Fiber Representation');

    fiberRepController.onFinishChange(function (value) {
        if (value === "all fibers") {
            afqb.three.colorGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyGroup.traverse(afqb.three.makeVisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeInvisible);
        } else {
            afqb.three.colorGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyGroup.traverse(afqb.three.makeInvisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeVisible);
        }

        // Update the query string
        afqb.global.updateQueryString(
            {three: {fiberRepresentation: value.toLowerCase().replace(/\s+/g, "-")}}
        );
    });

	var guiContainer = document.getElementById('three-gui-container');
	guiContainer.appendChild(afqb.three.gui.domElement);
	afqb.three.gui.close();

    // contain all bundles in this Group object
    // each bundle is represented by an Object3D
    // load fiber bundle using jQuery
	var greyCoreGeometry = new THREE.Geometry();
    var greyGeometry = new THREE.Geometry();

    $.getJSON("data/afq_streamlines.json", function (json) {
        Object.keys(json).forEach(function (bundleKey) {
            var oneBundle = json[bundleKey];
            var nFibers = 0;

            // Retrieve the core fiber and then delete it from the bundle object
            var coreFiber = oneBundle['coreFiber'];
            delete oneBundle['coreFiber'];

            // fiberKeys correspond to individual fibers in each fiber bundle
            // They may not be consecutive keys depending on the
            // downsampling of the input data, hence the need for `nFibers`
            // and `iFiber`
            //
            // First loop simply counts the number of fibers in this bundle
            // and asserts that each individual fiber has been resampled to
            // the same size.
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
            Object.keys(oneBundle).forEach(function (fiberKey, iFiber) {
                for (var i = 0; i < referenceLength - 1; i++) {
                    var oneFiber = oneBundle[fiberKey];

                    // Vertices must be added in pairs. Later a
                    // line segment will be drawn in between each pair.
                    // This requires some repeat values to have a
                    // continuous line but will allow us to avoid
                    // having the beginning and end of the fiber
                    // connect.
                    var offset = i * nFibers * 6 + iFiber * 6;
                    positions.set(oneFiber[i].concat(oneFiber[i+1]), offset);
                }
            });

            // Create a buffered geometry and line segments from these
            // positions. Buffered Geometry is slightly more performant
            // and necessary to interact with d3 brushing later on.
            var bundleGeometry = new THREE.BufferGeometry();
            bundleGeometry.addAttribute(
            	'position', new THREE.BufferAttribute(positions, 3)
			);
            greyGeometry.merge(
                new THREE.Geometry().fromBufferGeometry(bundleGeometry)
            );

            var coreBundlePath = coreFiber.map(function (element) {
                return new THREE.Vector3(element[0], element[1], element[2]);
            });
            var coreBundleCurve = new THREE.CatmullRomCurve3(coreBundlePath);
            var coreBundleGeometry = new THREE.TubeBufferGeometry(coreBundleCurve, 100, 1.8, 8, false);
            greyCoreGeometry.merge(
                new THREE.Geometry().fromBufferGeometry(coreBundleGeometry)
            );

            var colorBundleLine = new THREE.LineSegments(
            	bundleGeometry, afqb.three.colorLineMaterial
			);

            // Set scale to match the brain surface,
            // (determined by trial and error)
            colorBundleLine.scale.set(0.05,0.05,0.05);
            colorBundleLine.position.set(0, 0.8, -0.5);

            // Record some useful info for later
            colorBundleLine.name = bundleKey.toLowerCase().replace(/\s+/g, "-");
            colorBundleLine.nFibers = nFibers;

            afqb.three.colorGroup.add(colorBundleLine);

            coreBundleGeometry = new THREE.TubeBufferGeometry(coreBundleCurve, 100, 2, 8, false);
            var coreColorBundleMesh = new THREE.Mesh(
                coreBundleGeometry, afqb.three.colorCoreMaterial
            );

            // Set scale to match the brain surface,
            // (determined by trial and error)
            coreColorBundleMesh.scale.set(0.05,0.05,0.05);
            coreColorBundleMesh.position.set(0, 0.8, -0.5);

            // Record some useful info for later
            coreColorBundleMesh.name = bundleKey.toLowerCase().replace(/\s+/g, "-");
            coreColorBundleMesh.nFibers = 1;

            afqb.three.colorCoreGroup.add(coreColorBundleMesh);
        });

		// Set material properties for each fiber bundle
		// And add event listeners for mouseover, etc.
        var groups = [afqb.three.colorGroup, afqb.three.colorCoreGroup];
        groups.forEach(function (group) {
            group.traverse(function (child) {
                if (child instanceof THREE.LineSegments || child instanceof THREE.Mesh) {
                    domEvents.addEventListener(child, 'mouseover', function() {
                        if(!afqb.global.mouse.isDown) {
                            afqb.three.mouseoverBundle(group, child);
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
                            var myBundle = d3.selectAll("input.tracts").filter(function (d) {
                                return d.toLowerCase().replace(/\s+/g, "-") === child.name;
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
                    domEvents.addEventListener(child, 'mouseout', function() {
                        afqb.three.mouseoutBundle(child.name);
                        return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
                    });
                }
            });
        });

        var greyBundleLine = new THREE.LineSegments(greyGeometry, afqb.three.greyLineMaterial);
        greyBundleLine.scale.set(0.05,0.05,0.05);
        greyBundleLine.position.set(0, 0.8, -0.5);

        afqb.three.greyGroup.add(greyBundleLine);

        var greyCoreMesh = new THREE.Mesh(greyCoreGeometry, afqb.three.greyCoreMaterial);
        greyCoreMesh.scale.set(0.05,0.05,0.05);
        greyCoreMesh.position.set(0, 0.8, -0.5);
        afqb.three.greyCoreGroup.add(greyCoreMesh);

        afqb.three.greyCoreGroup.renderOrder = 1;
        afqb.three.greyCoreGroup.traverse(function (object) {
            object.renderOrder = 1;
        });

        afqb.three.greyGroup.renderOrder = 1;
        afqb.three.greyGroup.traverse(function (object) {
            object.renderOrder = 1;
        });

        afqb.three.colorCoreGroup.renderOrder = 2;
        afqb.three.colorCoreGroup.traverse(function (object) {
            object.renderOrder = 2;
        });

        afqb.three.colorGroup.renderOrder = 2;
        afqb.three.colorGroup.traverse(function (object) {
            object.renderOrder = 2;
        });

        if (afqb.global.controls.threeControlBox.fiberRepresentation === "all fibers") {
            afqb.three.colorGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyGroup.traverse(afqb.three.makeVisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeInvisible);
        } else {
            afqb.three.colorGroup.traverse(afqb.three.makeInvisible);
            afqb.three.greyGroup.traverse(afqb.three.makeInvisible);
            afqb.three.colorCoreGroup.traverse(afqb.three.makeVisible);
            afqb.three.greyCoreGroup.traverse(afqb.three.makeVisible);
        }

		// Finally add fiber bundle group to the afqb.three.scene.
  		afqb.three.scene.add(afqb.three.colorGroup);
		afqb.three.scene.add(afqb.three.greyGroup);
        afqb.three.scene.add(afqb.three.colorCoreGroup);
        afqb.three.scene.add(afqb.three.greyCoreGroup);

        if (callback) { callback(null); }
        afqb.three.brushOn3D();
    });

    window.addEventListener('resize', afqb.three.onWindowResize, false);
    afqb.three.orbitControls = new THREE.OrbitControls(afqb.three.camera, afqb.three.renderer.domElement);
    afqb.three.orbitControls.addEventListener('change', afqb.three.lightUpdate);
    afqb.three.orbitControls.enableKeys = false;

    afqb.three.renderer.domElement.addEventListener('click', function() {
		// Update the query string
		var cameraPosition = afqb.three.camera.position.clone();
        afqb.global.updateQueryString(
            {three: {cameraPosition: cameraPosition}}
        );
    }, false);
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

    if (afqb.global.mouse.brushing) {
        afqb.three.brushOn3D();
    }
};

afqb.three.brushOn3D = function () {
// For each fiber bundle update the length of fiber to be plotted
// based on the d3 brushes in the 2D plots
    afqb.three.colorGroup.children.forEach(function (element) {
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
        var lo = Math.floor(afqb.plots.settings.brushes[element.name].brushExtent[0]);
        var hi = Math.ceil(afqb.plots.settings.brushes[element.name].brushExtent[1]) - 1;

        // loIdx is the low index and count is the number of indices
        // This is a little sloppy and sometimes the count will be too high
        // but the visual offset should be minimal.
        // TODO: Positions come in pairs, with all vertices except the first
        // and last being repeated. Take this into account to make loIdx and
        // count correct (not just good enough).
        var position = element.geometry.attributes.position;
        var uv = element.geometry.attributes.uv;
        var totalLength = position.itemSize * position.count + uv.itemSize * uv.count;

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

afqb.three.lightUpdate = function () {
    "use strict";
    afqb.three.directionalLight.position.copy(afqb.three.camera.position);
};

// Visibility toggle function to show/hide core fibers vs streamlines
afqb.three.makeVisible = function (object) {
    object.visible = true;
};

// Visibility toggle function to show/hide core fibers vs streamlines
afqb.three.makeInvisible = function (object) {
    object.visible = false;
};

// Highlight specified bundle based on left panel checkboxes
afqb.three.highlightBundle = function (state, name) {
    "use strict";
    var names = afqb.plots.tracts.map(function(name) {
        return name.toLowerCase().replace(/\s+/g, "-");
    });
    var index = names.indexOf(name);

    var groups = [afqb.three.colorGroup, afqb.three.colorCoreGroup];
    groups.forEach(function (group) {
        var tmpMaterial = {};
        if (group === afqb.three.colorCoreGroup) {
            // Temporary mesh material for moused-over bundles
            tmpMaterial = new THREE.MeshBasicMaterial({
                opacity: 1.0, // afqb.three.settings.colorOpacity,
                transparent: false // true,
                // depthWrite: true
            });
        } else {
            // Temporary line material for moused-over bundles
            tmpMaterial = new THREE.LineBasicMaterial({
                opacity: afqb.three.settings.colorOpacity,
                linewidth: afqb.three.settings.colorLineWidth,
                transparent: true,
                depthWrite: true
            });
        }

        var bundle = group.children.filter(function (element) {
            return element.name === name;
        })[0];

        if (bundle !== undefined) {
            if (state === true) {
                tmpMaterial.color.setHex(afqb.global.colors[index]);
                bundle.material = tmpMaterial;
            } else {
                bundle.material = afqb.three.colorLineMaterial;
            }
        }
    });

    return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
};

afqb.three.mouseoutBundle = function (name) {
    var myBundle = d3.selectAll("input.tracts").filter(function (d) {
    	return d.toLowerCase().replace(/\s+/g, "-") === name;
    })[0][0];
    afqb.three.highlightBundle(myBundle.checked, myBundle.name);
};

// Highlight specified bundle based on mouseover
afqb.three.mouseoverBundle = function (group, child) {
    "use strict";
    var name = child.name;
	if (afqb.global.controls.threeControlBox.highlight) {
		var bundle = group.children.filter(function (element) {
			return element.name === name;
        })[0];

		if (bundle !== undefined) {
            var tracts = afqb.plots.tracts.map(function (element) {
                return element.toLowerCase().replace(/\s+/g, "-");
            });
            var idx = tracts.indexOf(name);

			var tmpMaterial = {};
			if (child instanceof THREE.Mesh) {
                // Temporary mesh material for moused-over bundles
                tmpMaterial = new THREE.MeshBasicMaterial({
                    opacity: 1.0, // afqb.three.settings.highlightOpacity,
                    transparent: false // true
                });

            } else {
                // Temporary line material for moused-over bundles
                tmpMaterial = new THREE.LineBasicMaterial({
                    opacity: afqb.three.settings.highlightOpacity,
                    linewidth: afqb.three.settings.highlightLineWidth,
                    transparent: true
                });
            }

            tmpMaterial.color.setHex( afqb.global.highlightColors[idx] );
            if (afqb.plots.settings.brushes[name].brushOn) {
                tmpMaterial.color.setHex( 0x000000 );
            }

            bundle.material = tmpMaterial;

			return afqb.three.renderer.render(afqb.three.scene, afqb.three.camera);
		}
	}
};

afqb.global.queues.threeQ = d3_queue.queue();
afqb.global.queues.threeQ.defer(afqb.global.initSettings);
afqb.global.queues.threeQ.await(afqb.three.initAndAnimate);


// var $window = $(window),
//    $stickyEl = $('#statcontent'),
//    elTop = $stickyEl.offset().top;

// $window.scroll(function() {
//     $stickyEl.toggleClass('sticky', $window.scrollTop() > elTop);
// });
