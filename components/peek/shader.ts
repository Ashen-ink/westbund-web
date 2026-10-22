// A rounded picture at `frame` (centre xy, half-size zw, in CSS px), cover-fitted, developed from
// ARTIFACT blue Bayer dots into the photograph as `dither` falls from 1 to 0.
export const SHADER = /* wgsl */ `
struct Uniforms {
  frame: vec4f,
  fit: vec4f,
  color: vec3f,
  dpr: f32,
  frameR: f32,
  dither: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

fn coverage(d: f32) -> f32 {
  return clamp(0.5 - d / max(fwidth(d), 0.0001), 0.0, 1.0);
}
fn bayer2(p: vec2f) -> f32 {
  let a = floor(p);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
fn bayer4(a: vec2f) -> f32 { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
fn bayer8(a: vec2f) -> f32 { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
fn band(value: f32) -> f32 { return clamp((value - 0.04) / 0.92, 0.0, 1.0); }
fn sdBox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
@fragment
fn main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = position.xy / u.dpr;
  let mask = coverage(sdBox(p - u.frame.xy, u.frame.zw, u.frameR));
  let local = (p - (u.frame.xy - u.frame.zw)) / max(u.frame.zw * 2.0, vec2f(1.0));
  let src = textureSampleLevel(image, linearSampler, local * u.fit.xy + u.fit.zw, 0.0).rgb;
  let amount = band(u.dither);
  let cell = floor(p * 0.5);
  let lum = smoothstep(0.08, 0.92, dot(src, vec3f(0.2126, 0.7152, 0.0722)));
  let dotted = select(vec3f(1.0), u.color, lum < bayer8(cell));
  let color = select(src, dotted, bayer8(cell + vec2f(3.0, 5.0)) < amount);
  return vec4f(color * mask, mask);
}
`;
