// TableRow.tsx
'use client';

import React from 'react';
import { DataRow } from '@/types/types';
import { Icons } from '../common/Icons';
import { Overlay, Side } from './Overlay';

type AnimationType = 'flap' | 'slider';
type Mode = 'cover' | 'highlight';

interface InputCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
}

const InputCell: React.FC<InputCellProps> = ({ value, onChange, placeholder }) => (
  <input
    type="number"
    value={value === null ? '' : value}
    onChange={(e) => {
      const newValue = e.target.value ? Number(e.target.value) : null;
      onChange(newValue);
    }}
    className={`
      w-full h-full px-2 py-1 text-center
      bg-light-background-secondary dark:bg-[rgb(40,50,65)]
      placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary
      placeholder:text-shadow-none
      focus:outline-none focus:ring-0
      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
    `}
    placeholder={placeholder}
  />
);

interface TableRowProps {
  row: DataRow;
  index: number;
  updateCell: (rowIndex: number, columnIndex: number, value: number | null) => void;
  toggleAssignment: (rowIndex: number) => void;
  addRow: () => void;
  deleteRow: (rowIndex: number) => void;
  isUnactivated: boolean;
  controlColumnIndex: number;
  toggleCollapse?: () => void;
  isCollapsed?: boolean;
  mode: Mode;
  animationType: AnimationType;
}

export const TableRow: React.FC<TableRowProps> = ({ 
  row, 
  index, 
  updateCell, 
  toggleAssignment, 
  addRow,
  deleteRow,
  isUnactivated,
  controlColumnIndex,
  toggleCollapse,
  isCollapsed,
  mode,
  animationType
}) => {
  const getCardSide = (assignment: number, mode: Mode): Side => {
    if (mode === 'highlight') {
      return assignment === 0 ? 'left' : 'right';
    } else if (mode === 'cover') {
      return assignment === 0 ? 'right' : 'left';
    }

    return 'none';
  }

  return (
    <div className={`flex items-stretch w-full h-14 py-2 bg-light-background dark:bg-dark-background ${isUnactivated ? 'sticky bottom-0' : ''}`}>
      {/* Index Column */}
      <div className="flex items-center justify-center w-12 flex-shrink-0 text-light-text-secondary dark:text-dark-text-secondary">
        {isUnactivated && toggleCollapse ? (
          <button
            onClick={toggleCollapse}
            className="focus:outline-none hover:opacity-80 transition-opacity"
            aria-label={isCollapsed ? "Expand rows" : "Collapse rows"}
          >
            {isCollapsed ? <Icons.Expand size={4} /> : <Icons.Collapse size={4} />}
          </button>
        ) : (
          index + 1
        )}
      </div>

      {/* Data Column */}
      <div className="flex-grow h-full">
        <Overlay
          side={isUnactivated ? 'none' : getCardSide(row.assignment, mode)}
          children={[
            <InputCell
              value={row.data[0]}
              onChange={(value) => updateCell(index, 0, value)}
              placeholder={controlColumnIndex === 0 ? "Control" : "Treatment"}
            />,
            <InputCell
              value={row.data[1]}
              onChange={(value) => updateCell(index, 1, value)}
              placeholder={controlColumnIndex === 1 ? "Control" : "Treatment"}
            />]
          }
        />
      </div>

      {/* Assignment Toggle Column */}
      <div className="flex items-center justify-center w-16 flex-shrink-0">
        <button
          onClick={() => toggleAssignment(index)}
          className={`w-6 h-6 rounded-md transition-colors duration-300
            ${isUnactivated 
              ? 'bg-light-background-tertiary dark:bg-dark-background-tertiary' 
              : row.assignment === 1
                ? 'bg-light-accent dark:bg-dark-accent' 
                : 'bg-light-primary dark:bg-dark-primary'}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-primary dark:focus:ring-dark-primary`}
          aria-label={row.assignment === 1 ? "Treatment assigned" : "Control assigned"}
        />
      </div>

      {/* Action Column */}
      <div className="flex items-center justify-center w-14 flex-shrink-0">
        {isUnactivated ? (
          <button 
            onClick={addRow}
            className="text-light-text-tertiary hover:text-light-success dark:text-dark-text-tertiary dark:hover:text-dark-success focus:outline-none"
            aria-label="Add row"
          >
            <Icons.Add size={4}/>
          </button>
        ) : (
          <button 
            onClick={() => deleteRow(index)}
            className="text-light-text-tertiary hover:text-light-error dark:text-dark-text-tertiary dark:hover:text-dark-error focus:outline-none"
            aria-label="Delete row"
          >
            <Icons.Close size={4}/>
          </button>
        )}
      </div>
    </div>
  );
};

export default TableRow;