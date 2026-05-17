varying vec3 vPosition;
varying vec3 vNormal;
varying float vNoise;

uniform float uTime;
uniform vec3 uColorPrimary;
uniform vec3 uColorMid;
uniform vec3 uColorDeep;
uniform vec3 uCameraPosition;

void main() {
  float t = (vNoise + 1.0) * 0.5;
  vec3 color = mix(uColorDeep, uColorMid, smoothstep(0.0, 0.5, t));
  color = mix(color, uColorPrimary, smoothstep(0.5, 1.0, t));

  vec3 viewDir = normalize(uCameraPosition - vPosition);
  float rim = 1.0 - dot(viewDir, vNormal);
  rim = pow(rim, 2.0);
  color += uColorPrimary * rim * 0.5;

  float alpha = 1.0 - smoothstep(0.7, 1.0, rim);
  alpha = mix(0.85, 1.0, alpha);

  gl_FragColor = vec4(color, alpha);
}
