'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let m = 0.5;
let a = 1.5 * m;
let b = 3 * m;
let c = 2 * m;
let d = 2 * m;
let v_end_pi = 2;    
let t_end_pi = 2;

document.getElementById("draw").addEventListener("click", redraw);


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normal) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the attribute variable in the shader program.
    this.iAttribNormal = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    const normal = m4.identity();
    m4.inverse(modelView, normal);
    m4.transpose(normal, normal);

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normal);

    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1,1,0,1] );

    surface.Draw();
}

function CalculateVertex(v, t) {


    let f = a * b / Math.sqrt((a * a * Math.sin(v) * Math.sin(v) + b * b * Math.cos(v) * Math.cos(v)));
    let x = 0.5 * (f * (1 + Math.cos(t)) + (d * d - c * c) * ((1 - Math.cos(t)) / f)) * Math.cos(v);
    let y = 0.5 * (f * (1 + Math.cos(t)) + (d * d - c * c) * ((1 - Math.cos(t)) / f)) * Math.sin(v);
    let z = 0.5 * (f - ((d * d - c * c) / f)) * Math.sin(t);

    return([x,y,z]);
}

function calculateNormals(v, t, getVertexFunction) {
    let psi = 0.0001;
    let vertex = getVertexFunction(v, t);
    let vertexU = getVertexFunction(v, t + psi);
    let vertexV = getVertexFunction(v + psi, t);

    let dU = [
        (vertex[0] - vertexU[0]) / psi,
        (vertex[1] - vertexU[1]) / psi,
        (vertex[2] - vertexU[2]) / psi
    ];

    let dV = [
        (vertex[0] - vertexV[0]) / psi,
        (vertex[1] - vertexV[1]) / psi,
        (vertex[2] - vertexV[2]) / psi
    ];

    let normal = m4.normalize(m4.cross(dU, dV));

    return normal;
}

function CreateSurfaceData() {
    

    let vertexList = [];
    let normalList = [];

    for (let v = 0; v <= v_end_pi * Math.PI; v += 0.1) {
        for (let t = 0; t <= t_end_pi * Math.PI; t += 0.1) {
            let vertex1 = CalculateVertex(v, t);
            let vertex2 = CalculateVertex(v, t + 0.1);
            let vertex3 = CalculateVertex(v + 0.1, t);
            let vertex4 = CalculateVertex(v + 0.1, t + 0.1);

            let Normal1 = calculateNormals(v, t, CalculateVertex);
            let Normal2 = calculateNormals(v, t + 0.1, CalculateVertex);
            let Normal3 = calculateNormals(v + 0.1, t, CalculateVertex);
            let Normal4 = calculateNormals(v + 0.1, t + 0.1, CalculateVertex);

            vertexList.push(...vertex1, ...vertex2, ...vertex3, ...vertex3, ...vertex2, ...vertex4);
            normalList.push(...Normal1, ...Normal2, ...Normal3, ...Normal3, ...Normal2, ...Normal4);
        }
    }

    for  (let t = 0; t <= t_end_pi * Math.PI; t += 0.1){
        for (let v = 0; v <= v_end_pi * Math.PI; v += 0.1) {
            let vertex1 = CalculateVertex(v, t);
            let vertex2 = CalculateVertex(v, t + 0.1);
            let vertex3 = CalculateVertex(v + 0.1, t);
            let vertex4 = CalculateVertex(v + 0.1, t + 0.1);

            let Normal1 = calculateNormals(v, t, CalculateVertex);
            let Normal2 = calculateNormals(v, t + 0.1, CalculateVertex);
            let Normal3 = calculateNormals(v + 0.1, t, CalculateVertex);
            let Normal4 = calculateNormals(v + 0.1, t + 0.1, CalculateVertex);

            vertexList.push(...vertex1, ...vertex2, ...vertex3, ...vertex3, ...vertex2, ...vertex4);
            normalList.push(...Normal1, ...Normal2, ...Normal3, ...Normal3, ...Normal2, ...Normal4);
        }
    }

    return [vertexList, normalList];
}

function CalculateVertexSphere(theta, phi, radius) {
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return [x, y, z];
}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, 'vertex');
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, 'normal');
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog,'ModelViewProjectionMatrix');
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog,'NormalM');
    shProgram.iColor                     = gl.getUniformLocation(prog, 'color');

    surface = new Model('Surface');
    surface.BufferData(...CreateSurfaceData());

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL(true);  // initialize the WebGL graphics context
        spaceball = new TrackballRotator(canvas, draw, 0);
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    draw();
}


function redraw() {
    CreateSurfaceData()
    init()
}