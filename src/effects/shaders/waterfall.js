// Waterfall — horizontal scan line sweep
const waterfallShader = `
uniform shader image;
uniform float2 resolution;
uniform float time;

half4 main(float2 coord) {
    float lineY = mod(time * 200.0, resolution.y);
    float dist = abs(coord.y - lineY);
    half4 color = image.eval(coord);
    // Draw a cyan scan line
    if (dist < 2.0) {
        color = mix(color, half4(0.0, 1.0, 1.0, 1.0), 0.9);
    }
    return color;
}
`;

export default waterfallShader;
