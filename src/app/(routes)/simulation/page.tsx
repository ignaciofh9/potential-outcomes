'use client';

import React from 'react';
import { SimulationProvider } from '../../../contexts/SimulationContext';
import DataInput from '../../../components/DataInput/DataInput';
import DataControls from '../../../components/DataControls/DataControls';
import PlotDisplay from '@/components/PlotDisplay/PlotDisplay';
import SimulationControls from '@/components/SimulationControls/SimulationControls';

const SimulationPage: React.FC = () => {
  return (
    <SimulationProvider>
      <div className="flex flex-col h-screen py-3 px-5">
        <div className="flex-grow flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-4">
          <Card className="w-full lg:w-2/5">
            <SimulationControls />
          </Card>
          <Card className="w-full lg:w-3/5 flex flex-col">
            <div className="flex-shrink pb-5 max-h-[55%]">
              <DataControls />
              <DataInput />
            </div>
            <div className="flex-grow flex-shrink min-h-0 mt-4">
              <PlotDisplay />
            </div>
          </Card>
        </div>
      </div>
    </SimulationProvider>
  );
};

const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`bg-light-background dark:bg-dark-background shadow-lg rounded-xl p-4 border border-light-background-tertiary dark:border-dark-background-tertiary ${className}`}>
    {children}
  </div>
);

export default SimulationPage;