import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import HeroText from '../components/HeroText';
import GlobeScene from '../components/GlobeScene';
import ParticleField from '../components/ParticleField';
import '../styles/landing.css';

const Landing = () => {
    return (
        <div className="landing-container">
            {/* 3D Background */}
            <div className="canvas-container">
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <color attach="background" args={['#000000']} />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <Suspense fallback={null}>
                        <GlobeScene />
                        <ParticleField />
                    </Suspense>
                    <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        autoRotate={true}
                        autoRotateSpeed={0.5}
                        maxPolarAngle={Math.PI / 2}
                        minPolarAngle={Math.PI / 2}
                    />
                </Canvas>
            </div>

            {/* HTML Overlay */}
            <div className="ui-overlay">
                <HeroText />
            </div>
        </div>
    );
};

export default Landing;
