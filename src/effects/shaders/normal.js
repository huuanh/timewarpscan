// Normal — passthrough, no transformation
const normalShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    return image.eval(coord);
}
`;

export default normalShader;
