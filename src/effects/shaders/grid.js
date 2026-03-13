// Grid — 3x3 tile mosaic
const gridShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float cols = 3.0;
    float rows = 3.0;
    float2 tileSize = resolution / float2(cols, rows);
    float2 tileCoord = mod(coord, tileSize) / tileSize * resolution;
    return image.eval(tileCoord);
}
`;

export default gridShader;
