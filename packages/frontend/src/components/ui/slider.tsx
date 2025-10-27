import React from 'react';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  max: number;
  min: number;
  step: number;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  max,
  min,
  step,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([parseFloat(e.target.value)]);
  };

  return (
    <input
      type="range"
      value={value[0]}
      onChange={handleChange}
      max={max}
      min={min}
      step={step}
      className={`w-full ${className}`}
    />
  );
};
