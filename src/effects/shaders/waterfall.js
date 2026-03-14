// Waterfall — rolling scan line with horizontal smearing (TimeWarp preview)
const waterfallShader = `
uniform shader image;
uniform float2 resolution;
uniform float time;

half4 main(float2 coord) {
    float sweepSpeed = 300.0;
    float lineY = mod(time * sweepSpeed, resolution.y);
    float dist = abs(coord.y - lineY);

    // Horizontal smearing near scan — simulates rolling shutter distortion
    float smear = 28.0 * exp(-dist * 0.09);
    float2 sampleCoord = float2(
        coord.x + smear * sin(coord.y * 0.2 + time * 6.0),
        coord.y
    );
    sampleCoord = clamp(sampleCoord, float2(0.0), resolution - float2(1.0));

    half4 color = image.eval(sampleCoord);

    // Bright cyan scan line
    if (dist < 3.0) {
        float t = 1.0 - dist / 3.0;
        color = mix(color, half4(0.2, 1.0, 1.0, 1.0), t * 0.85);
    }

    return color;
}
`;

export default waterfallShader;
