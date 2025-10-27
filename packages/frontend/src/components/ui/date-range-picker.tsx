import React from 'react';

interface DateRange {
  from: Date;
  to: Date;
}

interface DatePickerWithRangeProps {
  from: Date;
  to: Date;
  onSelect: (range: DateRange | undefined) => void;
}

export const DatePickerWithRange: React.FC<DatePickerWithRangeProps> = ({ from, to, onSelect }) => {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = new Date(e.target.value);
    onSelect({ from: newFrom, to });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = new Date(e.target.value);
    onSelect({ from, to: newTo });
  };

  return (
    <div className="flex space-x-2">
      <input
        type="date"
        value={from.toISOString().split('T')[0]}
        onChange={handleFromChange}
        className="border rounded px-2 py-1"
      />
      <span className="self-center">to</span>
      <input
        type="date"
        value={to.toISOString().split('T')[0]}
        onChange={handleToChange}
        className="border rounded px-2 py-1"
      />
    </div>
  );
};
