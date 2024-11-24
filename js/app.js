
// Setup WebGL2 context and canvas
const canvas = document.getElementById("webglCanvas");
// canvas.width = window.innerWidth * 0.8;
// canvas.height = window.innerHeight * 0.8;

const gl = canvas.getContext("webgl2");
if (!gl) {
  alert("WebGL2 is not supported in this browser!");
  throw new Error("WebGL2 not supported.");
}

const textCanvasCtx = document.getElementById("textCanvas").getContext("2d");

// Vertex shader source
const vertexShaderSource = `#version 300 es
    in vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = 10.0; // Adjust size for brush strokes
    }`;

// Fragment shader source
const fragmentShaderSource = `#version 300 es
    precision highp float;
    uniform vec4 u_color;
    out vec4 outColor;
    void main() {
        outColor = u_color;
    }`;

// Compile shader function
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// Link program function
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// Create shaders and program
const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

// Get attribute and uniform locations
const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const colorUniformLocation = gl.getUniformLocation(program, "u_color");

// Create and bind buffer
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// Setup VAO
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// Set clear color
gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background
// gl.clear(gl.COLOR_BUFFER_BIT);

// Enable blending for transparency
// gl.enable(gl.BLEND);
// gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Drawing variables
// let drawing = false;
// let points = [];
//
// canvas.addEventListener("mousedown", (event) => {
//   drawing = true;
//   addPoint(event);
// });
//
// canvas.addEventListener("mouseup", () => {
//   drawing = false;
// });
//
// canvas.addEventListener("mousemove", (event) => {
//   if (drawing) {
//     addPoint(event);
//   }
// });
//
// // Add points to the buffer and draw
// function addPoint(event) {
//   const rect = canvas.getBoundingClientRect();
//   const x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
//   const y = ((rect.bottom - event.clientY) / canvas.height) * 2 - 1;
//
//   points.push(x, y);
//   draw();
// }
//
// // Render the points
// function draw() {
//   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STREAM_DRAW);
//
//   gl.useProgram(program);
//   gl.bindVertexArray(vao);
//
//   // Set brush color
//   gl.uniform4f(colorUniformLocation, Math.random(), Math.random(), Math.random(), 1.0); // Random color
//   gl.drawArrays(gl.POINTS, 0, points.length / 2);
// }



// Variables for the sine wave
let time = 0; // Time for animation
const amplitude = 0.8; // Amplitude of the sine wave
const frequency = 1; // Frequency of the sine wave
const numPoints = 200; // Number of points in the sine wave
const points = new Float32Array(numPoints * 2);

let frames = 0;
let lastFpsTime = Date.now();

function renderFps() {
  let curTime = Date.now();
  if (curTime - lastFpsTime >= 1000) {
    lastFpsTime = curTime;
    textCanvasCtx.clearRect(0, 0, textCanvasCtx.canvas.width, textCanvasCtx.canvas.height);
    textCanvasCtx.fillText("FPS: " + frames, 20, 20);
    frames = 0;
  }
  frames += 1;
}

function updateSineWave(time) {
  for (let i = 0; i <= numPoints * 2; i+=2) {
    points[i] = (i / numPoints) * 2 - 1; // Map i to the range [-1, 1]
    points[i + 1] = amplitude * Math.sin((points[i] + time * 0.1) * frequency * Math.PI * 2); // Calculate sine wave
  }
}

let lastFrameTime = Date.now();

// Animation loop
function render() {
  const curTime = Date.now();
  time += (curTime - lastFrameTime) / 1000;
  lastFrameTime = curTime;
  updateSineWave(time);

  // Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Update buffer data
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STREAM_DRAW);

  // Use the program and draw points
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  // Set wave color
  gl.uniform4f(colorUniformLocation, 0.2, 0.6, 0.8, 1.0); // Blue color
  gl.drawArrays(gl.POINTS, 0, points.length / 2);

  renderFps();

  // Request next frame
  // requestAnimationFrame(render);
  setTimeout(render, 10)
}

// Start rendering
render();
