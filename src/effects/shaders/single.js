// Single — vertical split with cyan divider line
const singleShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float2 uv = coord;
    float halfW = resolution.x * 0.5;
    if (uv.x < halfW) {
        uv.x = uv.x * 2.0;
    } else {
        uv.x = (uv.x - halfW) * 2.0;
    }
    half4 color = image.eval(uv);
    // Draw a cyan vertical divider line in the middle
    if (abs(coord.x - halfW) < 1.5) {
        color = half4(0.0, 1.0, 1.0, 1.0);
    }
    return color;
}
`;

export default singleShader;
