// Mirror — left half mirrored to right
const mirrorShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float2 uv = coord;
    if (uv.x > resolution.x * 0.5) {
        uv.x = resolution.x - uv.x;
    }
    return image.eval(uv);
}
`;

export default mirrorShader;
