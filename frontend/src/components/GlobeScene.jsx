import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

const GlobeScene = () => {
    const planetRef = useRef();
    const atmosphereRef = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (planetRef.current) {
            planetRef.current.rotation.y = t * 0.05;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 6]}>
            {/* Solid Planet */}
            <Sphere ref={planetRef} args={[2.5, 64, 64]}>
                <meshStandardMaterial
                    color="#2a0a4a"
                    emissive="#1a0b2e"
                    emissiveIntensity={0.5}
                    roughness={0.7}
                    metalness={0.8}
                />
            </Sphere>

            {/* Atmosphere Glow */}
            <Sphere ref={atmosphereRef} args={[2.7, 64, 64]}>
                <meshBasicMaterial
                    color="#6366f1"
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </Sphere>

            {/* Wireframe Overlay for Tech feel */}
            <Sphere args={[2.52, 64, 64]}>
                <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.05} />
            </Sphere>
        </group>
    );
};

export default GlobeScene;
