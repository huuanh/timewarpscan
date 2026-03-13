// Swirl — spiral distortion from center
const swirlShader = `
uniform shader image;
uniform float2 resolution;

half4 main(float2 coord) {
    float2 center = resolution * 0.5;
    float2 uv = coord - center;
    float r = length(uv);
    float maxR = length(center);
    float angle = atan(uv.y, uv.x);
    float strength = 2.0 * (1.0 - r / maxR);
    angle += strength;
    float2 rotated = float2(cos(angle), sin(angle)) * r + center;
    rotated = clamp(rotated, float2(0.0), resolution - float2(1.0));
    return image.eval(rotated);
}
`;

export default swirlShader;
