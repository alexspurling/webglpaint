
// Setup WebGL2 context and canvas
const canvas = document.getElementById("webglCanvas");

const gl = canvas.getContext("webgl2", { alpha: false });
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
        gl_PointSize = 15.0; // Adjust size for brush strokes
    }`;

// Fragment shader source
const fragmentShaderSource = `#version 300 es
    precision highp float;
    uniform vec4 u_color;
    uniform vec2 u_resolution;
    uniform vec2 u_points[1000]; // Max 100 points
    uniform int u_numPoints;
    out vec4 outColor;
    void main() {
        vec4 color = vec4(u_color.xyz, 0.0); // Default background color

        float circleRadius = 50.0;
        for (int i = 0; i < 1000; i++) {
            if (i >= u_numPoints) break;
            vec2 point = u_points[i];
            float dist = distance(gl_FragCoord.xy, point);
            if (dist < circleRadius) {
                float alpha = smoothstep(circleRadius, circleRadius - 1.0, dist);
                color = vec4(1.0, 0.0, 0.0, alpha);
            }
        }

        // Otherwise, use the specified color
        outColor = color;
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
const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
const pointsUniformLocation = gl.getUniformLocation(program, "u_points");
const numPointsUniformLocation = gl.getUniformLocation(program, "u_numPoints");

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
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


// Variables for the sine wave
let time = 0; // Time for animation
const amplitude = 0.8; // Amplitude of the sine wave
const frequency = 1; // Frequency of the sine wave
let numPoints = 1; // Number of points in the sine wave
let points = new Float32Array([100, 100]);

let quad = new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]);
// let quad = new Float32Array([-0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]);

let frames = 0;
let lastFpsTime = Date.now();

function renderFps() {
  let curTime = Date.now();
  if (curTime - lastFpsTime >= 1000) {
    lastFpsTime = curTime;
    textCanvasCtx.clearRect(0, 0, textCanvasCtx.canvas.width, textCanvasCtx.canvas.height);
    textCanvasCtx.fillText("FPS: " + frames, 20, 20);
    textCanvasCtx.fillText("Points: " + points.length / 2, 20, 40);
    frames = 0;
  }
  frames += 1;
}

function updateSineWave(time) {
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * 2 - 1; // Map i to the range [-1, 1]
    const y = amplitude * Math.sin((x + time * 0.1) * frequency * Math.PI * 2);
    points[i * 2] = x;
    points[i * 2 + 1] = y;
  }
}

let lastFrameTime = Date.now();

// Animation loop
function render() {
  const curTime = Date.now();
  time += (curTime - lastFrameTime) / 1000;
  lastFrameTime = curTime;
  // updateSineWave(time);
  // const points = new Float32Array([-0.125, 0.125, 0, 0, 0.125, 0.125]);

  // Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Update buffer data
  // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  // Use the program and draw points
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  // Set wave color
  gl.uniform4f(colorUniformLocation, 0.2, 0.6, 0.8, 1.0); // Blue color
  gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
  gl.uniform2fv(pointsUniformLocation, points);
  gl.uniform1i(numPointsUniformLocation, points.length / 2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, quad.length / 2);

  renderFps();

  // Request next frame
  // requestAnimationFrame(render);
  setTimeout(render, 10)
}

canvas.addEventListener("mousemove", (e) => {
  if (e.buttons == 1 && (e.movementX != 0 || e.movementY != 0)) {
    numPoints += 1;
    const newArray = new Float32Array(numPoints * 2);
    newArray.set(points);
    newArray[(numPoints * 2) - 2] = e.layerX;
    newArray[(numPoints * 2) - 1] = canvas.height - e.layerY;
    points = newArray;
  }
});

// Start rendering
render();
