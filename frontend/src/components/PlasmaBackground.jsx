import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PlasmaShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#5227FF') },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec2 uMouse;
    varying vec2 vUv;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = vUv;
        
        // Fluid distortion based on time and noise
        float t = uTime * 0.2;
        
        // Layered noise for "plasma" feel
        float n1 = snoise(uv * 3.0 + vec2(t, t * 0.5));
        float n2 = snoise(uv * 6.0 - vec2(t * 0.6, t));
        float n3 = snoise(uv * 12.0 + vec2(t * 0.2, -t * 0.4));
        
        // Combine noise layers
        float noiseSum = (n1 * 0.5 + n2 * 0.25 + n3 * 0.125) + 0.5; // normalize roughly 0..1
        
        // Mouse interaction (ripple effect)
        float dist = distance(uv, uMouse);
        float mouseEffect = smoothstep(0.4, 0.0, dist) * 0.2;
        
        // Color blending
        vec3 baseColor = uColor * 0.1; // Darker base
        vec3 highlightColor = vec3(1.0, 1.0, 1.0); // White highlights
        vec3 accentColor = vec3(0.6, 0.4, 1.0); // Purple accent
        
        // Mixing logic
        vec3 visual = mix(baseColor, accentColor, noiseSum);
        visual = mix(visual, highlightColor, smoothstep(0.7, 1.0, noiseSum + mouseEffect));
        
        // Vignette
        float vignette = smoothstep(1.2, 0.5, length(uv - 0.5) * 1.5);
        visual *= vignette;

        gl_FragColor = vec4(visual, 1.0);
    }
  `
};

const PlasmaPlane = ({ color, mouseInteractive }) => {
    const mesh = useRef();
    const shaderMaterial = useRef();

    // Create shader material only once
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(color) },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uResolution: { value: new THREE.Vector2(1, 1) }
            },
            vertexShader: PlasmaShaderMaterial.vertexShader,
            fragmentShader: PlasmaShaderMaterial.fragmentShader,
        });
    }, [color]);

    useFrame((state) => {
        if (shaderMaterial.current) {
            shaderMaterial.current.uniforms.uTime.value = state.clock.getElapsedTime();

            if (mouseInteractive) {
                // Normalize mouse position (-1 to 1) to (0 to 1)
                const mouseX = (state.mouse.x + 1) / 2;
                const mouseY = (state.mouse.y + 1) / 2;

                // Smoothly interpolate current mouse value
                shaderMaterial.current.uniforms.uMouse.value.lerp(
                    new THREE.Vector2(mouseX, mouseY),
                    0.1
                );
            }
        }
    });

    return (
        <mesh ref={mesh} scale={[10, 10, 1]}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial ref={shaderMaterial} args={[material]} />
        </mesh>
    );
};

const PlasmaBackground = ({
    color = "#5227FF",
    mouseInteractive = true
}) => {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
            <Canvas camera={{ position: [0, 0, 1] }}>
                <PlasmaPlane color={color} mouseInteractive={mouseInteractive} />
            </Canvas>
        </div>
    );
};

export default PlasmaBackground;
