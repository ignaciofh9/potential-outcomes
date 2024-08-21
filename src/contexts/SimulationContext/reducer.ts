import { SimulationState, SimulationAction, UserDataState, ErrorState } from './types';
import { emptyRow, validateSimulationSpeed, validateSelectedTestStatistic, validateTotalSimulations, validatePValueType } from './utils';
import { ExperimentalTestStatistic, testStatistics } from './testStatistics';
import { INITIAL_STATE } from './constants';

export const simulationReducer = (state: SimulationState, action: SimulationAction): SimulationState => {
  const updateHistory = (newUserData: UserDataState): Partial<SimulationState> => ({
    past: [...state.past, state.data.userData],
    future: [],
    data: { ...state.data, userData: newUserData },
  });

  const setError = (message: string): ErrorState => ({ message });

  switch (action.type) {
    case 'SET_USER_DATA':
      if (!action.payload) {
        return { ...state, error: setError('User data payload is required') };
      }
      return { ...state, ...updateHistory(action.payload), error: null };

    case 'RESET_USER_DATA':
      const initialUserData: UserDataState = INITIAL_STATE.data.userData;
      return { 
        ...state, 
        ...updateHistory(initialUserData),
        results: { simulationResults: [], pValue: null, observedStatistic: null },
        error: null
      };
    
    case 'EMPTY_USER_DATA':
      const emptyRows = state.data.userData.rows.map(row => ({
        data: state.data.userData.columns.map(() => null),
        assignment: row.assignment,
        block: null
      }));
      return {
        ...state,
        ...updateHistory({
          ...state.data.userData,
          rows: emptyRows
        }),
        error: null
      };

    case 'ADD_ROW':
      const newRow = emptyRow(state.data.userData.columns.length);
      const newRows = [...state.data.userData.rows];
      newRows[newRows.length - 1].assignment = 1;
      newRows.push(newRow);
      return { ...state, ...updateHistory({ ...state.data.userData, rows: newRows }), error: null };

    case 'DELETE_ROW':
      if (action.payload < 0 || action.payload >= state.data.userData.rows.length) {
        return { ...state, error: setError(`Invalid row index ${action.payload}`) };
      }
      const updatedRows = state.data.userData.rows.filter((_, index) => index !== action.payload);
      return { ...state, ...updateHistory({ ...state.data.userData, rows: updatedRows }), error: null };

    case 'UPDATE_CELL': {
      const { rowIndex, columnIndex, value } = action.payload;
      if (rowIndex < 0 || rowIndex >= state.data.userData.rows.length) {
        return { ...state, error: setError(`Invalid row index ${rowIndex}`) };
      }
      if (columnIndex < 0 || columnIndex >= state.data.userData.columns.length) {
        return { ...state, error: setError(`Invalid column index ${columnIndex}`) };
      }
      const isLastRow = rowIndex === state.data.userData.rows.length - 1;
      const updatedRows = state.data.userData.rows.map((row, index) => {
        if (index === rowIndex) {
          const updatedRow = { 
            ...row, 
            data: [...row.data.slice(0, columnIndex), value, ...row.data.slice(columnIndex + 1)] 
          };
          if (isLastRow) {
            updatedRow.assignment = columnIndex;
          }
          return updatedRow;
        }
        return row;
      });
      
      if (isLastRow && value !== null) {
        updatedRows.push(emptyRow(state.data.userData.columns.length));
      }
    
      const updatedUserData = {
        ...state.data.userData,
        rows: updatedRows
      };
      return { ...state, ...updateHistory(updatedUserData), error: null };
    }

    case 'SET_BLOCK': {
      const { rowIndex, block } = action.payload;
      if (rowIndex < 0 || rowIndex >= state.data.userData.rows.length) {
        return { ...state, error: setError(`Invalid row index ${rowIndex}`) };
      }
      const updatedRows = state.data.userData.rows.map((row, index) => 
        index === rowIndex ? { ...row, block } : row
      );
      return { 
        ...state, 
        ...updateHistory({ ...state.data.userData, rows: updatedRows }),
        error: null
      };
    }
    
    case 'SET_ASSIGNMENT': {
      const { rowIndex, assignment } = action.payload;
      if (rowIndex < 0 || rowIndex >= state.data.userData.rows.length) {
        return { ...state, error: setError(`Invalid row index ${rowIndex}`) };
      }
      if (assignment !== null && (assignment < 0 || assignment >= state.data.userData.columns.length)) {
        return { ...state, error: setError(`Invalid assignment ${assignment}`) };
      }
      const isLastRow = rowIndex === state.data.userData.rows.length - 1;
      const updatedRows = state.data.userData.rows.map((row, index) => 
        index === rowIndex
          ? { ...row, assignment: assignment == null ? assignment : (assignment % state.data.userData.columns.length) }
          : row
      );
    
      if (isLastRow) {
        updatedRows.push(emptyRow(state.data.userData.columns.length));
      }
    
      const newUserData = {
        ...state.data.userData,
        rows: updatedRows
      };
      return { ...state, ...updateHistory(newUserData), error: null };
    }

    case 'RENAME_COLUMN':
      const { index, newName } = action.payload;
      if (index < 0 || index >= state.data.userData.columns.length) {
        return { ...state, error: setError(`Invalid column index ${index}`) };
      }
      if (!newName || newName.trim() === '') {
        return { ...state, error: setError('New column name cannot be empty') };
      }
      const newColumns = [...state.data.userData.columns];
      newColumns[index] = { ...newColumns[index], name: newName };
      return { ...state, ...updateHistory({ ...state.data.userData, columns: newColumns }), error: null };
    
    case 'ADD_COLUMN': {
      const newColumnName = action.payload;
      if (!newColumnName || newColumnName.trim() === '') {
        return { ...state, error: setError('New column name cannot be empty') };
      }
      const newColor = state.data.userData.colorStack[0] || 'text-gray-500';
      const newColorStack = state.data.userData.colorStack.slice(1);
      
      const rowsWithNewColumn = state.data.userData.rows.map(row => ({
        ...row,
        data: [...row.data, null],
      }));
    
      const newColumns = [...state.data.userData.columns, { name: newColumnName, color: newColor }];
    
      let newState = {
        ...state,
        ...updateHistory({
          ...state.data.userData,
          rows: rowsWithNewColumn,
          columns: newColumns,
          colorStack: newColorStack,
        }),
        error: null
      };
    
      if (state.data.userData.columns.length === 2 && newColumns.length === 3) {
        const currentTestStatistic = state.settings.selectedTestStatistic;
        if (!testStatistics[currentTestStatistic].supportsMultipleTreatments) {
          const newTestStatistic = Object.keys(testStatistics).find(
            key => testStatistics[key as ExperimentalTestStatistic].supportsMultipleTreatments
          ) as ExperimentalTestStatistic;
    
          if (newTestStatistic) {
            newState = {
              ...newState,
              settings: {
                ...newState.settings,
                selectedTestStatistic: newTestStatistic
              }
            };
          }
        }
      }
    
      return newState;
    }
    
    case 'REMOVE_COLUMN':
      const columnIndexToRemove = action.payload;
      if (columnIndexToRemove < 0 || columnIndexToRemove >= state.data.userData.columns.length) {
        return { ...state, error: setError(`Invalid column index ${columnIndexToRemove}`) };
      }
      if (state.data.userData.columns.length <= 2) {
        return { ...state, error: setError('Cannot remove column when there are only two columns') };
      }
      
      const removedColumn = state.data.userData.columns[columnIndexToRemove];
      const rowsWithColumnRemoved = state.data.userData.rows.map(row => ({
        ...row,
        data: row.data.filter((_, index) => index !== columnIndexToRemove),
        assignment: row.assignment === null ? null : 
                    (row.assignment >= columnIndexToRemove ? row.assignment - 1 : row.assignment),
      }));
      const updatedColumns = state.data.userData.columns.filter((_, index) => index !== columnIndexToRemove);
      const updatedColorStack = [...state.data.userData.colorStack, removedColumn.color];
    
      return {
        ...state,
        ...updateHistory({
          ...state.data.userData,
          rows: rowsWithColumnRemoved,
          columns: updatedColumns,
          colorStack: updatedColorStack,
        }),
        error: null
      };

    case 'SET_SIMULATION_SPEED':
      if (!validateSimulationSpeed(action.payload)) {
        return { ...state, error: setError(`Invalid simulation speed ${action.payload}`) };
      }
      return { ...state, settings: { ...state.settings, simulationSpeed: action.payload }, error: null };

    case 'SET_SELECTED_TEST_STATISTIC':
      if (!validateSelectedTestStatistic(action.payload)) {
        return { ...state, error: setError(`Invalid test statistic ${action.payload}`) };
      }
      return { ...state, settings: { ...state.settings, selectedTestStatistic: action.payload }, error: null };

    case 'SET_TOTAL_SIMULATIONS':
      if (!validateTotalSimulations(action.payload)) {
        return { ...state, error: setError(`Invalid total simulations ${action.payload}`) };
      }
      return { ...state, settings: { ...state.settings, totalSimulations: action.payload }, error: null };

    case 'SET_P_VALUE_TYPE':
      if (!validatePValueType(action.payload)) {
        return { ...state, error: setError(`Invalid p-value type ${action.payload}`) };
      }
      return { ...state, settings: { ...state.settings, pValueType: action.payload }, error: null };

    case 'START_SIMULATION':
      if (state.control.isSimulating) {
        return { ...state, error: setError('Simulation is already running') };
      }
      
      const completeRows = state.data.userData.rows.filter(row => 
        row.data.every(cell => cell !== null) && row.assignment !== null
      );

      if (completeRows.length < 2) {
        return { ...state, error: setError('Cannot start simulation with insufficient data. At least two complete rows are required.') };
      }

      return { ...state, control: { ...state.control, isSimulating: true }, error: null };

    case 'PAUSE_SIMULATION':
      if (!state.control.isSimulating) {
        return { ...state, error: setError('No simulation is currently running') };
      }
      return { ...state, control: { ...state.control, isSimulating: false }, error: null };

    case 'CLEAR_SIMULATION_DATA':
      return { ...state, results: { simulationResults: [], pValue: null, observedStatistic: null }, error: null };

    case 'SET_SIMULATION_RESULTS':
      if (!Array.isArray(action.payload)) {
        return { ...state, error: setError('Payload must be an array') };
      }
      return { ...state, results: { ...state.results, simulationResults: action.payload }, error: null };

    case 'SET_P_VALUE':
      if (typeof action.payload !== 'number' || action.payload < 0 || action.payload > 1) {
        return { ...state, error: setError(`Invalid p-value ${action.payload}`) };
      }
      return { ...state, results: { ...state.results, pValue: action.payload }, error: null };

    case 'SET_OBSERVED_STATISTIC':
      console.log('SET_OBSERVED_STATISTIC CALLED', action.payload);
      return { ...state, results: { ...state.results, observedStatistic: action.payload }, error: null };

    case 'SET_BLOCKING_ENABLED':
        return { 
          ...state, 
          settings: { 
            ...state.settings, 
            blockingEnabled: action.payload 
          }, 
          error: null 
        };

    case 'UNDO':
      if (state.past.length === 0) {
        return { ...state, error: setError('No more actions to undo') };
      }
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        ...state,
        past: newPast,
        data: { ...state.data, userData: previous },
        future: [state.data.userData, ...state.future],
        error: null
      };

    case 'REDO':
      if (state.future.length === 0) {
        return { ...state, error: setError('No more actions to redo') };
      }
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        ...state,
        past: [...state.past, state.data.userData],
        data: { ...state.data, userData: next },
        future: newFuture,
        error: null
      };

    default:
      return { ...state, error: setError(`Unhandled action type: ${(action as any).type}`) };
  }
};