// Split — top and bottom halves shown separately
const splitShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float2 uv = coord;
    float halfH = resolution.y * 0.5;
    if (uv.y < halfH) {
        uv.y = uv.y * 2.0;
    } else {
        uv.y = (uv.y - halfH) * 2.0;
    }
    half4 color = image.eval(uv);
    // Draw a cyan divider line in the middle
    if (abs(coord.y - halfH) < 1.5) {
        color = half4(0.0, 1.0, 1.0, 1.0);
    }
    return color;
}
`;

export default splitShader;
