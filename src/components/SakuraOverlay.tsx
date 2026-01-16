"use client";

import React, { useEffect, useState } from 'react';

const SakuraOverlay = () => {
  const [petals, setPetals] = useState<Array<{ id: number; left: number; delay: number; duration: number; size: number; rotation: number }>>([]);

  useEffect(() => {
    const petalCount = 80;
    const newPetals = Array.from({ length: petalCount }).map((_, i) => {
      let left = Math.random() * 100;
      if (left > 30 && left < 70 && Math.random() > 0.45) {
        left = Math.random() > 0.5 ? Math.random() * 30 : 70 + Math.random() * 30;
      }
      
      return {
        id: i,
        left,
        delay: Math.random() * 20,
        duration: 15 + Math.random() * 15,
        size: 4 + Math.random() * 4,
        rotation: Math.random() * 360,
      };
    });
    setPetals(newPetals);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="absolute top-[-10%]"
          style={{
            left: `${petal.left}%`,
            width: `${petal.size}px`,
            height: `${petal.size}px`,
            animation: `fall ${petal.duration}s linear ${petal.delay}s infinite`,
            opacity: 0.8,
          }}
        >
          <div
             style={{
               width: '100%',
               height: '100%',
               animation: `sway ${petal.duration * 0.4}s ease-in-out infinite alternate`,
             }}
          >
            <svg 
              viewBox="0 0 30 30" 
              className="w-full h-full drop-shadow-sm" 
              style={{ 
                filter: 'blur(0.5px)',
                transform: `rotate(${petal.rotation}deg)` 
              }}
            >
              <defs>
                <linearGradient id={`grad-${petal.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFC0CB" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#FFB7C5" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path 
                d="M15,0 C5,10 0,20 5,28 C10,33 20,33 25,28 C30,20 25,10 15,0 Z" 
                fill={`url(#grad-${petal.id})`}
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SakuraOverlay;
