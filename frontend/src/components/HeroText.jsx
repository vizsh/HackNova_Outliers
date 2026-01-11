import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const HeroText = () => {
    return (
        <div className="hero-content">
            <h1 className="main-title" style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.4))'
            }}>
                SWIFT LOGISTICS
            </h1>
            <h2 className="subtitle" style={{ letterSpacing: '0.8em', color: '#cbd5e1' }}>
                NEXT-GEN LOGISTICS
            </h2>
            <Link to="/login" className="cta-button">
                EXPLORE PLATFORM
            </Link>
        </div>
    );
};

export default HeroText;
