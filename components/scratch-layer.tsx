"use client";

import { useEffect, useRef } from "react";

type ScratchLayerProps = {
  onReveal: () => void;
  disabled?: boolean;
};

export function ScratchLayer({ onReveal, disabled = false }: ScratchLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const revealedRef = useRef(false);
  const onRevealRef = useRef(onReveal);

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const paintCover = () => {
      if (revealedRef.current) return;
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(bounds.width * scale));
      canvas.height = Math.max(1, Math.floor(bounds.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
      const gradient = context.createLinearGradient(0, 0, bounds.width, bounds.height);
      gradient.addColorStop(0, "#d8d2c2");
      gradient.addColorStop(0.45, "#f2eee4");
      gradient.addColorStop(1, "#c7c0ae");
      context.globalCompositeOperation = "source-over";
      context.fillStyle = gradient;
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = "rgba(55, 53, 46, .25)";
      context.font = "700 14px Arial";
      context.textAlign = "center";
      context.fillText("RASPE AQUI", bounds.width / 2, bounds.height / 2 + 5);
    };

    paintCover();
    const observer = new ResizeObserver(paintCover);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const scratchAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const bounds = canvas.getBoundingClientRect();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(event.clientX - bounds.left, event.clientY - bounds.top, 24, 0, Math.PI * 2);
    context.fill();
  };

  const checkProgress = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || revealedRef.current) return;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = 32;
    let transparent = 0;
    let sampled = 0;
    for (let index = 3; index < pixels.length; index += stride * 4) {
      sampled += 1;
      if (pixels[index] < 80) transparent += 1;
    }

    if (sampled > 0 && transparent / sampled >= 0.42) {
      revealedRef.current = true;
      context.clearRect(0, 0, canvas.width, canvas.height);
      onRevealRef.current();
    }
  };

  return (
    <div className={`scratch-surface${disabled ? " scratch-surface-disabled" : ""}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="scratch-canvas"
        onPointerDown={(event) => {
          if (disabled || revealedRef.current) return;
          drawingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          scratchAt(event);
        }}
        onPointerMove={(event) => {
          if (drawingRef.current && !disabled) scratchAt(event);
        }}
        onPointerUp={() => {
          drawingRef.current = false;
          checkProgress();
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
          checkProgress();
        }}
      />
      <button
        className="reveal-button"
        type="button"
        onClick={() => {
          if (disabled || revealedRef.current) return;
          revealedRef.current = true;
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
          onRevealRef.current();
        }}
        disabled={disabled}
      >
        Revelar resultado sem raspar
      </button>
    </div>
  );
}
