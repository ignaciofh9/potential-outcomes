// contexts/SimulationContext/utils.ts

import { DataRow } from './types';
import { ExperimentalTestStatistic, TestStatisticFunction, TestStatisticMeta } from './testStatistics';
import { sum } from 'mathjs';

// Utility function to create a new row
export const createNewRow = (columnCount: number, assignment: number): DataRow => ({
  data: Array(columnCount).fill(null),
  assignment,
});

// Utility function to calculate ranks for Wilcoxon Rank-Sum test
export const rank = (values: number[]): number[] => {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = Array(values.length);
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].value !== sorted[i - 1].value) {
      currentRank = i + 1;
    }
    ranks[sorted[i].index] = currentRank;
  }

  return ranks;
};

// Utility function to shuffle an array (used in simulation)
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Utility function to filter valid rows
export const filterValidRows = (rows: DataRow[]): DataRow[] => {
  return rows.slice(0, -1).filter(row => row.data.every(value => value !== null));
};

// Test statistic functions
export const differenceInMeans: TestStatisticFunction = (data: DataRow[]) => {
  if (!data || data.length === 0) return 0;

  const groups = data.reduce((acc, row) => {
    const value = row.data[row.assignment];
    if (typeof value === 'number') {
      if (!acc[row.assignment]) acc[row.assignment] = [];
      acc[row.assignment].push(value);
    }
    return acc;
  }, {} as Record<number, number[]>);

  const groupMeans = Object.values(groups).map(group =>
    group.length > 0 ? group.reduce((sum, value) => sum + value, 0) / group.length : 0
  );

  return groupMeans.length >= 2 ? groupMeans[1] - groupMeans[0] : 0;
};

export const wilcoxonRankSum: TestStatisticFunction = (data: DataRow[]) => {
  if (!data || data.length === 0) return 0;

  const groups = data.reduce((acc, row) => {
    const value = row.data[0];
    if (typeof value === 'number') {
      if (!acc[row.assignment]) acc[row.assignment] = [];
      acc[row.assignment].push(value);
    }
    return acc;
  }, {} as Record<number, number[]>);

  const groupValues = Object.values(groups);
  if (groupValues.length !== 2) {
    throw new Error('Wilcoxon rank-sum test requires exactly two groups.');
  }

  const [group1, group2] = groupValues;
  const combined = [...group1, ...group2];
  const ranks = rank(combined);

  const rankSumGroup1 = sum(ranks.slice(0, group1.length));
  const n1 = group1.length;
  const n2 = group2.length;

  const U1 = rankSumGroup1 - (n1 * (n1 + 1)) / 2;
  const U2 = (n1 * n2) - U1;

  return Math.min(U1, U2);
};

export const testStatistics: Record<ExperimentalTestStatistic, TestStatisticMeta> = {
  [ExperimentalTestStatistic.DifferenceInMeans]: {
    name: "Difference in Means",
    function: differenceInMeans,
    supportsMultipleTreatments: false
  },
  [ExperimentalTestStatistic.WilcoxonRankSum]: {
    name: "Wilcoxon Rank-Sum",
    function: wilcoxonRankSum,
    supportsMultipleTreatments: false
  }
};

export const calculatePValue = (
  originalTestStatistic: number,
  simulationResults: DataRow[][],
  testStatistic: ExperimentalTestStatistic,
  pValueType: 'two-tailed' | 'left-tailed' | 'right-tailed'
): number => {
  const totalSimulations = simulationResults.length;
  let extremeCount = 0;

  switch (pValueType) {
    case 'two-tailed':
      extremeCount = simulationResults.filter(result => 
        Math.abs(testStatistics[testStatistic].function(result)) >= Math.abs(originalTestStatistic)
      ).length;
      break;
    case 'left-tailed':
      extremeCount = simulationResults.filter(result => 
        testStatistics[testStatistic].function(result) <= originalTestStatistic
      ).length;
      break;
    case 'right-tailed':
      extremeCount = simulationResults.filter(result => 
        testStatistics[testStatistic].function(result) >= originalTestStatistic
      ).length;
      break;
  }

  return extremeCount / totalSimulations;
};

export const validateSimulationSpeed = (speed: number): boolean => speed >= 1 && speed <= 100;
export const validateSelectedTestStatistic = (stat: ExperimentalTestStatistic): boolean => 
  Object.values(ExperimentalTestStatistic).includes(stat);
export const validateTotalSimulations = (total: number): boolean => total >= 1 && total <= 10000;
export const validatePValueType = (type: 'two-tailed' | 'left-tailed' | 'right-tailed'): boolean => 
  ['two-tailed', 'left-tailed', 'right-tailed'].includes(type);

export const createActionResult = <T>(action: () => T): { success: boolean; error?: string; value?: T } => {
  try {
    const result = action();
    return { success: true, value: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' };
  }
};