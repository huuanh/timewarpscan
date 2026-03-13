// Double — two copies side by side, left half tinted
const doubleShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float2 uv = coord;
    uv.x = mod(uv.x * 2.0, resolution.x);
    half4 color = image.eval(uv);
    // Tint left half with warm tone
    if (coord.x < resolution.x * 0.5) {
        color = half4(color.r * 1.0, color.g * 0.6, color.b * 0.6, color.a);
    }
    return color;
}
`;

export default doubleShader;
