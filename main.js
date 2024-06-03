'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let audioContext;
let track;
let panner;
let lowpassFilter;
let angle = 0;
const radius = 2; // Radius of the circle for the sphere

let m = 0.5;
let a = 1.5 * m;
let b = 3 * m;
let c = 2 * m;
let d = 2 * m;
let v_end_pi = 2;
let t_end_pi = 2;

// 3d part
let stereo_camera;
let conv = 1;
let eyes = 1;
let fov = 45;
let near_clips = 2;
let horizontal_steps = 0;

let webCamera;
let webCameraTexture;
let webCameraModel;
let sphereCoords = { x: 0, y: 0, z: 0 };
let sphere;
let startTime = null;

// Vertex shader
const vertexShaderSource = `
attribute vec3 vertex;
attribute vec2 textureCoords;
uniform mat4 ModelViewProjectionMatrix;

varying vec2 vTC;
uniform bool textured;

void main() {
    if (textured) {
        vTC = textureCoords;
    }
    gl_Position = ModelViewProjectionMatrix * vec4(vertex, 1.0);
}`;

// Fragment shader
const fragmentShaderSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform vec4 color;
uniform sampler2D TMU;
varying vec2 vTC;
uniform bool textured;

void main() {
    vec4 tColor = texture2D(TMU, vTC);
    gl_FragColor = textured ? tColor : color;
}`;

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iVertexTextureBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        this.count = vertices.length / 3;
    };

    this.TextureBufferData = function (vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    };

    this.DrawLines = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        let n = this.count / horizontal_steps;
        for (let i = 0; i < horizontal_steps; i++) {
            gl.drawArrays(gl.LINE_STRIP, n * i, n);
        }
    };

    this.DrawTextured = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertexTexture, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertexTexture);
        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    };
}

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iAttribVertexTexture = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iT = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    };
}

function draw(animate = false) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -5);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    gl.uniform1f(shProgram.iT, true);
    gl.bindTexture(gl.TEXTURE_2D, webCameraTexture);

    if (webCamera.readyState >= 2) { // Check if the video is ready
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            webCamera
        );
    }

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.identity());
    if (webCameraModel) {
        webCameraModel.DrawTextured();
    }
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(shProgram.iT, false);

    let modelViewProjection = m4.multiply(projection, matAccum1);
    stereo_camera.ApplyLeftFrustum();
    modelViewProjection = m4.multiply(stereo_camera.projection, m4.multiply(stereo_camera.modelView, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(true, false, false, false);
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
    surface.DrawTextured();
    gl.uniform4fv(shProgram.iColor, [0, 0, 1, 1]);
    surface.DrawLines();

    drawSphere(modelViewProjection);

    gl.clear(gl.DEPTH_BUFFER_BIT);

    stereo_camera.ApplyRightFrustum();
    modelViewProjection = m4.multiply(stereo_camera.projection, m4.multiply(stereo_camera.modelView, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
    surface.DrawTextured();
    gl.uniform4fv(shProgram.iColor, [0, 0, 1, 1]);
    surface.DrawLines();

    drawSphere(modelViewProjection);

    gl.colorMask(true, true, true, true);

    if (animate) {
        window.requestAnimationFrame(() => {
            draw(true);
        });
    }
}

function drawSphere(modelViewProjection) {
    moveSphere();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.positionBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indexBuffer);

    gl.uniform4fv(shProgram.iColor, [1, 0, 0, 1]);  // Sphere color (red)
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.translation(sphereCoords.x, sphereCoords.y, sphereCoords.z));

    gl.drawElements(gl.TRIANGLES, sphere.vertexCount, gl.UNSIGNED_SHORT, 0);
}

function CalculateVertex(v, t) {
    let f = a * b / Math.sqrt((a * a * Math.sin(v) * Math.sin(v) + b * b * Math.cos(v) * Math.cos(v)));
    let x = 0.5 * (f * (1 + Math.cos(t)) + (d * d - c * c) * ((1 - Math.cos(t)) / f)) * Math.cos(v);
    let y = 0.5 * (f * (1 + Math.cos(t)) + (d * d - c * c) * ((1 - Math.cos(t)) / f)) * Math.sin(v);
    let z = 0.5 * (f - ((d * d - c * c) / f)) * Math.sin(t);

    return [x, y, z];
}

function CreateSurfaceData() {
    let vertexList = [];

    for (let v = 0; v <= v_end_pi * Math.PI; v += 0.1) {
        for (let t = 0; t <= t_end_pi * Math.PI; t += 0.1) {
            let vertex1 = CalculateVertex(v, t);
            let vertex2 = CalculateVertex(v, t + 0.1);
            let vertex3 = CalculateVertex(v + 0.1, t);
            let vertex4 = CalculateVertex(v + 0.1, t + 0.1);

            vertexList.push(...vertex1, ...vertex2, ...vertex3, ...vertex3, ...vertex2, ...vertex4);
            horizontal_steps++;
        }
    }

    for (let t = 0; t <= t_end_pi * Math.PI; t += 0.1) {
        for (let v = 0; v <= v_end_pi * Math.PI; v += 0.1) {
            let vertex1 = CalculateVertex(v, t);
            let vertex2 = CalculateVertex(v, t + 0.1);
            let vertex3 = CalculateVertex(v + 0.1, t);
            let vertex4 = CalculateVertex(v + 0.1, t + 0.1);

            vertexList.push(...vertex1, ...vertex2, ...vertex3, ...vertex3, ...vertex2, ...vertex4);
            horizontal_steps++;
        }
    }

    return vertexList;
}

function CreateSphereData() {
    const latitudeBands = 30;
    const longitudeBands = 30;
    const radius = 0.05;

    const vertexPositionData = [];
    const indexData = [];

    for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
        const theta = latNumber * Math.PI / latitudeBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let longNumber = 0; longNumber <= longitudeBands; longNumber++) {
            const phi = longNumber * 2 * Math.PI / longitudeBands;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            vertexPositionData.push(radius * x);
            vertexPositionData.push(radius * y);
            vertexPositionData.push(radius * z);
        }
    }

    for (let latNumber = 0; latNumber < latitudeBands; latNumber++) {
        for (let longNumber = 0; longNumber < longitudeBands; longNumber++) {
            const first = (latNumber * (longitudeBands + 1)) + longNumber;
            const second = first + longitudeBands + 1;
            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

    return {
        positionBuffer: positionBuffer,
        indexBuffer: indexBuffer,
        vertexCount: indexData.length
    };
}

function moveSphere() {
    let radius = 1.0;
    if (startTime === null) {
        startTime = performance.now();
    }
    let currentTime = performance.now();
    let elapsedTime = (currentTime - startTime) / 1000; // Time in seconds

    // Update sphere coordinates for circular motion
    sphereCoords.x = radius * Math.sin(elapsedTime);
    sphereCoords.y = 0;
    sphereCoords.z = radius * Math.cos(elapsedTime); // Assuming the sphere moves in the XY plane
    // Update the position of the sound panner to match the sphere's coordinates
    setPannerPosition(sphereCoords.x, sphereCoords.y, sphereCoords.z);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribVertexTexture = gl.getAttribLocation(prog, "textureCoords");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iT = gl.getUniformLocation(prog, "textured");

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData());
    surface.TextureBufferData(CreateSurfaceData());

    // Initialize sphere
    sphere = CreateSphereData();

    webCameraModel = new Model('Webcam');
    webCameraModel.BufferData([
        -1, -1, 0,
        1, -1, 0,
        1, 1, 0,
        -1, -1, 0,
        1, 1, 0,
        -1, 1, 0
    ]);
    webCameraModel.TextureBufferData([
        0, 1,
        1, 1,
        1, 0,
        0, 1,
        1, 0,
        0, 0
    ]);

    gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the identifier for that program. */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/* Initialization function that will be called when the page has loaded */
function init() {
    webCamera = getWebCamera();
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        initializeAudioControls();
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        stereo_camera = new StereoCamera(conv, eyes, 1, fov, near_clips, 30.0);
        initGL(); // initialize the WebGL graphics context
        spaceball = new TrackballRotator(canvas, draw, 0);
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }
    webCameraTexture = setTexture();
    spaceball = new TrackballRotator(canvas, draw, 0);
    draw(true);
}

function initializeAudioControls() {
    const audioElement = document.getElementById('audio');
    const lowpassCheckbox = document.getElementById('lowpass');

    function initializeAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        track = audioContext.createMediaElementSource(audioElement);

        panner = audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;

        lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 1000;

        updateAudioRouting();
    }

    function updateAudioRouting() {
        if (lowpassCheckbox.checked) {
            track.disconnect();
            track.connect(lowpassFilter).connect(panner).connect(audioContext.destination);
        } else {
            track.disconnect();
            track.connect(panner).connect(audioContext.destination);
        }
    }

    lowpassCheckbox.addEventListener('change', updateAudioRouting);

    audioElement.addEventListener('play', function () {
        if (!audioContext) {
            initializeAudio();
        }
    });

    audioElement.play().catch(() => {
        console.log('Audio playback prevented. User interaction required.');
    });
}

document.getElementById("conv").addEventListener("change", (e) => {
    conv = Number(document.getElementById('conv').value);
    document.getElementById("conv_indicator").innerHTML = conv;
    stereo_camera.mConvergence = conv;
    draw();
});

document.getElementById("eyes").addEventListener("change", (e) => {
    eyes = Number(document.getElementById('eyes').value);
    document.getElementById("eyes_indicator").innerHTML = eyes;
    stereo_camera.mEyeSeparation = eyes;
    draw();
});

document.getElementById("fov").addEventListener("change", (e) => {
    fov = (Number(document.getElementById('fov').value) * Math.PI) / 180;
    document.getElementById("fov_indicator").innerHTML = Number(document.getElementById('fov').value);
    stereo_camera.mFOV = fov;
    draw();
});

document.getElementById("near_clips").addEventListener("change", (e) => {
    near_clips = Number(document.getElementById('near_clips').value);
    document.getElementById("near_clips_indicator").innerHTML = near_clips;
    stereo_camera.mNearClippingDistance = near_clips;
    draw();
});

function setPannerPosition(x, y, z) {
    if (panner) {
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;
    }
}
