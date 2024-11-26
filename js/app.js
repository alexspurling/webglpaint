
const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl2", { alpha: false });

if (!gl) {
    alert("WebGL2 is not supported on this browser.");
    throw new Error("WebGL2 not supported.");
}

const textCanvasCtx = document.getElementById("textCanvas").getContext("2d");

// Vertex shader for fullscreen quad
const vertexShaderSource = `#version 300 es
    precision highp float;
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5; // Map [-1, 1] to [0, 1]
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
    `;

// Fragment shader for circles
const fragmentShaderSource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 fragColor;

    uniform vec2 u_resolution;
    // uniform vec2 u_points[100];
    uniform vec2 u_new_point;
    uniform int u_numPoints;
    uniform float u_circleRadius;
    uniform sampler2D u_prevTexture;
    uniform sampler2D u_pointTexture;
    uniform bool u_showSDF;
    uniform bool u_usePrevTexture;
    uniform int u_startPointIdx;
    uniform float u_time;

    float distanceToLineSegment(vec2 uv, vec2 linePoint1, vec2 linePoint2) {
        vec2 line = linePoint2 - linePoint1;
        vec2 perp = normalize(vec2(-line.y, line.x));
        vec2 curPoint = uv - linePoint1;
        float distFromLine = abs(dot(curPoint, perp)); // shortest distance from point to the line for this line segment
        float curPointDotPoint1 = dot(curPoint, line);
        float curPointDotPoint2 = dot(uv - linePoint2, line);

        float dist = distance(uv, linePoint2);

        // Ensure that we are somewhere between the two points of this line segment
        if (distFromLine < dist && curPointDotPoint1 > 0.0 && curPointDotPoint2 < 0.0) {
            dist = distFromLine;
        }

        return dist;
    }

    float distanceToLine(vec2 uv, int startIndex) {

        // First get the distance to the first point on the line
        vec2 firstPoint = texelFetch(u_pointTexture, ivec2(startIndex, 0), 0).xy;
        float dist = distance(uv, firstPoint);

        // Then iterate over each line segment
        for (int i = startIndex; i < u_numPoints - 1; i++) {
            vec2 linePoint1 = texelFetch(u_pointTexture, ivec2(i, 0), 0).xy;
            vec2 linePoint2 = texelFetch(u_pointTexture, ivec2(i + 1, 0), 0).xy;
            dist = min(dist, distanceToLineSegment(uv, linePoint1, linePoint2));
        }

        return dist;
    }

    void main() {
        vec4 color = vec4(0.0); // Default background color
        vec2 uv = v_uv * u_resolution; // Convert to pixel coordinates

        vec3 lineColor = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), (1.0 + cos(u_time)) / 2.0);

        int startPointIdx = 0;

        // Most points have already been drawn onto the the texture. We only need to start drawing
        // from the provided index
        if (u_usePrevTexture) {
            color = texture(u_prevTexture, v_uv);
            startPointIdx = u_startPointIdx;
        }

        float dist = distanceToLine(uv, startPointIdx);
        if (dist < u_circleRadius) {
            // float alpha = smoothstep(u_circleRadius, u_circleRadius - 1.0, dist);
            // float alpha = 1.0 - (dist / u_circleRadius);
            float alpha = 1.0 - (dist - u_circleRadius + 1.0) / 1.0; // Simple linear anti-aliasing function
            // color = vec4(0.2, 0.4, 1.0, alpha);

            vec3 blendedRGB = mix(color.rgb, vec3(0.2, 0.4, 1.0), alpha);
            float blendedAlpha = alpha + color.a * (1.0 - alpha);
            color = vec4(lineColor, alpha);
        }
        // Distance field as a gradient
        // color = vec4(mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), dist / 100.0), 1.0);

        if (u_showSDF) {
            vec3 col = (dist > u_circleRadius) ? vec3(0.9, 0.6, 0.3) : vec3(0.65, 0.85, 1.0);
            col *= 1.0 - exp(-2.0 * abs(dist));
            col *= 0.4 + 0.5 * cos(1.0 * dist);
            col = mix(col, vec3(1.0), 1.0 - smoothstep(0.0, 0.01, abs(dist)));
            color = vec4(col, 1.0);
        }

        fragColor = color;
    }
    `;

// Fragment shader to display texture
const displayShaderSource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 fragColor;

    uniform sampler2D u_displayTexture;

    void main() {
        fragColor = texture(u_displayTexture, v_uv);
    }
    `;

// Compile shader function
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Create program function
function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Error linking program:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Create shaders and programs
const circleProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
const displayProgram = createProgram(gl, vertexShaderSource, displayShaderSource);

// Fullscreen quad setup
const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const vao = gl.createVertexArray();
const vbo = gl.createBuffer();

gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(circleProgram, "a_position");
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);

gl.bindVertexArray(null);
// Enable blending for transparency
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Uniform locations
const uResolution = gl.getUniformLocation(circleProgram, "u_resolution");
const uPoints = gl.getUniformLocation(circleProgram, "u_points");
const uNewPoint = gl.getUniformLocation(circleProgram, "u_new_point");
const uNumPoints = gl.getUniformLocation(circleProgram, "u_numPoints");
const uCircleRadius = gl.getUniformLocation(circleProgram, "u_circleRadius");
const uShowSDF = gl.getUniformLocation(circleProgram, "u_showSDF");
const uUsePrevTexture = gl.getUniformLocation(circleProgram, "u_usePrevTexture");
const uStartPointIdx = gl.getUniformLocation(circleProgram, "u_startPointIdx");
const uTime = gl.getUniformLocation(circleProgram, "u_time");
const uPrevTexture = gl.getUniformLocation(circleProgram, "u_prevTexture");
const uPointTexture = gl.getUniformLocation(circleProgram, "u_pointTexture");
const uDisplayTexture = gl.getUniformLocation(displayProgram, "u_displayTexture");

let frames = 0;
let lastFpsTime = Date.now();
let numCalculations = 0;

function renderFps() {
    let curTime = Date.now();
    if (curTime - lastFpsTime >= 1000) {
        lastFpsTime = curTime;
        textCanvasCtx.clearRect(0, 0, textCanvasCtx.canvas.width, textCanvasCtx.canvas.height);
        textCanvasCtx.font = "12px Verdana";
        textCanvasCtx.fillText("FPS: " + frames, 10, 20);
        textCanvasCtx.fillText("Points: " + points.length, 10, 40);
        textCanvasCtx.fillText("Calculations per second: " + numCalculations, 10, 60);
        frames = 0;
        numCalculations = 0;
    }
    frames += 1;
}

// Set initial uniform values
const points = [
    [200, 300],
    [400, 500],
    [600, 400],
    [800, 500],
];
let numPointsRendered = 0;
let newPoint = [400, 500];
let redraw = true;
let showSDF = false;
let renderToTextureFlag = false;
let renderFromTextureFlag = false;
let cycleLineColor = false;
let backgroundColor = [0.85, 0.9, 1.0, 1.0]; // Light blue

// Create two textures
const textures = [];
const framebuffers = [];

for (let i = 0; i < 2; i++) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textures.push(texture);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    framebuffers.push(framebuffer);
}

// Texture used to pass point data to the shader - not sure if an array buffer is better?
const pointTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, pointTexture);
gl.texImage2D(gl.TEXTURE_2D, 0,
    gl.RG32F,               // 2-component (x, y) float format
    4096,                   // Width
    1,                      // Height (single row)
    0,                      // Border
    gl.RG,                  // Format
    gl.FLOAT,               // Data type
    null                    // Data
);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
// gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null); // Ensure no unpack buffer is active

// Ensure everything is unbound
gl.bindTexture(gl.TEXTURE_2D, null);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// Update renderToTexture to use ping-pong
let readIndex = 0;

function renderToTexture() {
    const writeIndex = 1 - readIndex;

    // Bind the framebuffer for writing
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[writeIndex]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(backgroundColor[0], backgroundColor[1], backgroundColor[2], backgroundColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the circle program for rendering
    gl.useProgram(circleProgram);

    // Bind the input texture (from the other framebuffer)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[readIndex]);
    gl.uniform1i(uPrevTexture, 0);

    // gl.uniform2f(uPoints, points.flat());
    gl.uniform2f(uNewPoint, newPoint[0], newPoint[1]);
    gl.uniform1i(uNumPoints, points.length);
    gl.uniform1f(uCircleRadius, 10.0);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1i(uShowSDF, showSDF);
    gl.uniform1i(uUsePrevTexture, renderFromTextureFlag);
    if (cycleLineColor) {
        gl.uniform1f(uTime, (Date.now() * 0.005) % (2 * Math.PI));
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pointTexture);

    // Store the points to render in a texture
    const pointsFloatArray = new Float32Array(points.slice(numPointsRendered).flat());
    gl.texSubImage2D(gl.TEXTURE_2D, 0, numPointsRendered, 0, pointsFloatArray.length / 2, 1, gl.RG, gl.FLOAT, pointsFloatArray);
    gl.uniform1i(uPointTexture, 1);
    // We need to subtract 1 from the start index because drawing the next line segment will require re-using the
    // previously added point
    gl.uniform1i(uStartPointIdx, Math.max(0, numPointsRendered - 1));
    // console.log("Drawing " + pointsFloatArray.length / 2 + " points starting at idx " + Math.max(0, numPointsRendered - 1));

    numPointsRendered = points.length;

    // Draw to the framebuffer
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Swap the read/write textures
    readIndex = writeIndex;

    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// Update the renderToScreen function to always use the current read texture
function renderToScreen() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(backgroundColor[0], backgroundColor[1], backgroundColor[2], backgroundColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(displayProgram);

    // Bind the texture to display
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[readIndex]);
    gl.uniform1i(uDisplayTexture, 0);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
}

// Main render loop
function render() {
    if (redraw || !renderToTextureFlag) {
        renderToTexture();
        numCalculations += points.length * canvas.height * canvas.width;
        redraw = false;
    }
    renderToScreen();
    renderFps();
    requestAnimationFrame(render);
    // setTimeout(render, 16);
}

function addPoint(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left; //x position within the element.
    const y = canvas.height - (e.clientY - rect.top);  //y position within the element.
    if (Math.abs(x - newPoint[0]) > 2 || Math.abs(y - newPoint[1]) > 2) {
        newPoint = [x, y];
        points.push(newPoint);
        redraw = true;
    }
}

canvas.addEventListener("mousemove", (e) => {
    if (e.buttons === 1 && (e.movementX !== 0 || e.movementY !== 0)) {
        addPoint(e);
    }
});

canvas.addEventListener("mousedown", (e) => {
    if (e.buttons === 1) {
        addPoint(e);
    }
});

function toggleShowSDF() {
    showSDF = !showSDF;
    redraw = true;
};

function toggleRenderToTexture() {
    renderToTextureFlag = !renderToTextureFlag;
};

function toggleRenderFromTexture() {
    renderFromTextureFlag = !renderFromTextureFlag;
    redraw = true;
};

function toggleCycleLineColor() {
    cycleLineColor = !cycleLineColor;
    redraw = true;
};

function changeBackground() {
    backgroundColor = [Math.random(), Math.random(), Math.random(), 1.0];
    redraw = true;
};

render();
