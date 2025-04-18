import React, { useEffect } from 'react';

import styles from './LowPolyBackgroundComponent.module.scss';

type Point = { x: number; y: number };

const LowPolyBackgroundComponent = () => {
  useEffect(() => {
    const canvas = document.getElementById('low-poly-grid-background') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseColor1 = '#15aabf';
    const baseColor2 = '#4c6ef5';
    const cellSize = 40;

    const lerpColor = (a: string, b: string, t: number): string => {
      const ah = parseInt(a.slice(1), 16);
      const bh = parseInt(b.slice(1), 16);
      const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
      const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
      return `rgb(${Math.round(ar + t * (br - ar))}, ${Math.round(ag + t * (bg - ag))}, ${Math.round(ab + t * (bb - ab))})`;
    };

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cols = Math.ceil(width / cellSize) + 1;
    const rows = Math.ceil(height / cellSize) + 1;
    const points: Point[][] = [];

    for (let row = 0; row < rows; row++) {
      points[row] = [];
      for (let col = 0; col < cols; col++) {
        const x = col * cellSize + Math.random() * cellSize;
        const y = row * cellSize + Math.random() * cellSize;
        points[row][col] = { x, y };
      }
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.03)';
    ctx.shadowBlur = 1;
    ctx.lineWidth = dpr >= 2 ? 0.8 : 1;

    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const p1 = points[i][j];
        const p2 = points[i][j + 1];
        const p3 = points[i + 1][j + 1];
        const p4 = points[i + 1][j];

        const distances = [p1, p2, p3, p4].map(
          (p) => (Math.abs(p.x - width) + Math.abs(p.y - height)) / (width + height)
        );
        const avgDist = distances.reduce((a, b) => a + b, 0) / 4;
        const color = lerpColor(baseColor1, baseColor2, avgDist);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
      }
    }

    const gradient = ctx.createLinearGradient(width, height, width * 0.7, height * 0.3);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');   // fully transparent at bottom-right
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)'); // soft white at center
    gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');   // fully white at top-left
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, []);

  return <canvas id='low-poly-grid-background' className={styles.canvas} />;
};

export default LowPolyBackgroundComponent;
