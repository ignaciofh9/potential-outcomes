import React, { createContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { simulationReducer } from './reducer';
import * as actions from './actions';
import { SimulationContextType, SimulationState, ActionResult, DataRow, SimulationResult, PValueType, WarningCondition } from './types';
import { createActionResult, calculatePValue, shuffleRowAssignments, filterValidRows, speedToDuration } from './utils';
import { testStatistics } from './testStatistics';
import { INITIAL_STATE } from './constants';

export const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [state, dispatch] = useReducer(simulationReducer, INITIAL_STATE);
  const simulationSpeedRef = useRef<number>(state.settings.simulationSpeed);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const dispatchWithResult = useCallback(<T extends any[]>(
    actionCreator: (...args: T) => ReturnType<typeof actions[keyof typeof actions]>,
    warningConditions?: WarningCondition[]
  ) => (...args: T): ActionResult => {
    const action = actionCreator(...args);
    
    dispatch(action);
    
    // Access the updated state after dispatch
    const updatedState = simulationReducer(state, action);
  
    if (updatedState.error) {
      console.error('Error in action dispatch:', updatedState.error.message);
      return { 
        success: false, 
        error: updatedState.error.message
      };
    }
  
    // Check for warnings after successful dispatch
    const activeWarnings = warningConditions?.filter(condition => condition.check(updatedState)) || [];
    const warningMessage = activeWarnings.length > 0
      ? activeWarnings.map(warning => warning.message).join('; ')
      : undefined;
  
    return { 
      success: true, 
      warning: warningMessage 
    };
  }, [state, dispatch]);

  const setSimulationSpeed = useCallback((speed: number): ActionResult => {
    return createActionResult(() => {
      simulationSpeedRef.current = speed;
      dispatch(actions.setSimulationSpeed(speed));
    });
  }, []);
  
  const setUserData = dispatchWithResult(actions.setUserData);
  const resetUserData = dispatchWithResult(actions.resetUserData);
  const emptyUserData = dispatchWithResult(actions.emptyUserData);
  
  const addRow = dispatchWithResult(
    actions.addRow,
    [
      { check: () => state.data.userData.rows.length > 50, message: "Adding too many rows may impact performance" },
      { check: () => state.data.userData.rows.length > 100, message: "Extremely large datasets may cause stability issues" }
    ]
  );
  
  const deleteRow = dispatchWithResult(actions.deleteRow);
  const updateCell = dispatchWithResult(actions.updateCell);
  const setAssignment = dispatchWithResult(actions.setAssignment);
  const setBlock = dispatchWithResult(actions.setBlock);
  const renameColumn = dispatchWithResult(actions.renameColumn);
  const addColumn = dispatchWithResult(actions.addColumn);
  const removeColumn = dispatchWithResult(actions.removeColumn);
  const setSelectedTestStatistic = dispatchWithResult(actions.setSelectedTestStatistic);
  const setTotalSimulations = dispatchWithResult(actions.setTotalSimulations);
  const setPValueType = dispatchWithResult(actions.setPValueType);
  const clearSimulationData = dispatchWithResult(actions.clearSimulationData);
  const undo = dispatchWithResult(actions.undo);
  const redo = dispatchWithResult(actions.redo);
  const startSimulation = dispatchWithResult(actions.startSimulation);
  const pauseSimulation = dispatchWithResult(actions.pauseSimulation);

  const simulate = useCallback((data: DataRow[]): SimulationResult => {
    const validData = filterValidRows(data);
    const shuffledData = shuffleRowAssignments(validData, state.settings.blockingEnabled);
    return new SimulationResult(shuffledData);
  }, []);

  const dynamicDelay = useCallback((): Promise<void> => {
    console.log('simulationSpeedRef.current', simulationSpeedRef.current);
    const adjustedDelay = speedToDuration(simulationSpeedRef.current);
    console.log('adjustedDelay', adjustedDelay);
    return new Promise((resolve, reject) => {
      timeoutIdRef.current = window.setTimeout(() => {
        timeoutIdRef.current = null;
        resolve();
      }, Math.max(0, adjustedDelay));
    });
  }, []);

  const runSimulation = useCallback(async (
    data: DataRow[],
    iterations: number,
    existingResults: SimulationResult[],
    abortSignal: AbortSignal,
    onProgress: (simulationResults: SimulationResult[], pValue: number) => void
  ): Promise<{ results: SimulationResult[], aborted: boolean }> => {
    let simulationResults = [...existingResults];
  
    for (let i = simulationResults.length; i < iterations; i++) {
      if (abortSignal.aborted) {
        return { results: simulationResults, aborted: true };
      }
  
      const result = simulate(data);
      simulationResults.push(result);
  
      const currentPValue = calculatePValue(
        state.results.observedStatistic!,
        simulationResults,
        state.settings.selectedTestStatistic,
        state.settings.pValueType
      );
  
      onProgress(simulationResults, currentPValue);
  
      try {
        await dynamicDelay();
      } catch (error) {
        if (abortSignal.aborted) {
          return { results: simulationResults, aborted: true };
        }
        throw error;
      }
    }
  
    return { results: simulationResults, aborted: false };
  }, [simulate, state.results.observedStatistic, state.settings.selectedTestStatistic, state.settings.pValueType, dynamicDelay]);

  useEffect(() => {
    if (state.control.isSimulating && !abortControllerRef.current) {
      abortControllerRef.current = new AbortController();

      const rowsCopy = state.data.userData.rows.map(row => ({ ...row }));

      runSimulation(
        rowsCopy,
        state.settings.totalSimulations,
        state.results.simulationResults,
        abortControllerRef.current.signal,
        (simulationResults, pValue) => {
          dispatch(actions.setSimulationResults(simulationResults));
          dispatch(actions.setPValue(pValue));
        }
      ).then(({ results, aborted }) => {
        if (!aborted) {
          dispatch(actions.setSimulationResults(results));
          const finalPValue = calculatePValue(
            state.results.observedStatistic!,
            results,
            state.settings.selectedTestStatistic,
            state.settings.pValueType
          );
          dispatch(actions.setPValue(finalPValue));
        }
      }).catch((error) => {
        console.error('Simulation error:', error);
      }).finally(() => {
        dispatch(actions.pauseSimulation());
        abortControllerRef.current = null;
      });
    } else if (!state.control.isSimulating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }
  }, [state.control.isSimulating, state.data.userData.rows, state.settings.totalSimulations, state.results.simulationResults, state.results.observedStatistic, state.settings.selectedTestStatistic, state.settings.pValueType, runSimulation]);

  
  useEffect(() => {
    const newObservedStatistic = testStatistics[state.settings.selectedTestStatistic].function(state.data.userData.rows);
  
    dispatch(actions.setObservedStatistic(newObservedStatistic));
    
    if (state.results.simulationResults.length > 0) {
      const newPValue = calculatePValue(
        newObservedStatistic,
        state.results.simulationResults,
        state.settings.selectedTestStatistic,
        state.settings.pValueType
      );
      dispatch(actions.setPValue(newPValue));
    }
  }, [state.data.userData.rows, state.settings.selectedTestStatistic, state.settings.pValueType, state.results.simulationResults]);
  
  const contextValue: SimulationContextType = {
    data: {
      ...state.data,
      setUserData,
      resetUserData,
      emptyUserData,
      addRow,
      deleteRow,
      updateCell,
      setAssignment,
      setBlock,
      renameColumn,
      addColumn,
      removeColumn
    },
    settings: {
      ...state.settings,
      setSimulationSpeed,
      setSelectedTestStatistic,
      setTotalSimulations,
      setPValueType,
    },
    control: {
      ...state.control,
      startSimulation,
      pauseSimulation,
      clearSimulationData,
    },
    results: state.results,
    history: {
      ...state.history,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undo,
      redo,
    },
    error: state.error,
  };

  return (
    <SimulationContext.Provider value={contextValue}>
      {children}
    </SimulationContext.Provider>
  );
};