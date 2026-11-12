import { newId } from '../../utils/ids';
import { FinancialMovementDTO, FinancialBalanceDTO, RubroType } from '../types';

/**
 * FinancialService: Módulo financiero y contable integral para la explotación pecuaria.
 * Soporta ingresos, egresos, desglose por rubro productivo (Porcino, Bovino, Avícola),
 * cálculo de márgenes y sincronización de balances.
 */
class FinancialService {
  private movements: FinancialMovementDTO[] = [];

  constructor() {
    this.seedFinancialMovements();
  }

  private seedFinancialMovements() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getMovements(filters?: {
    rubro?: RubroType;
    type?: 'ingreso' | 'egreso';
    month?: string; // YYYY-MM
  }): Promise<FinancialMovementDTO[]> {
    let list = [...this.movements];
    if (filters?.rubro) {
      list = list.filter((m) => m.rubro === filters.rubro || m.rubro === 'general');
    }
    if (filters?.type) {
      list = list.filter((m) => m.type === filters.type);
    }
    if (filters?.month) {
      list = list.filter((m) => m.date.startsWith(filters.month!));
    }
    return list;
  }

  public async createMovement(dto: Omit<FinancialMovementDTO, 'id'>): Promise<FinancialMovementDTO> {
    const id = newId('fm');
    const newMov: FinancialMovementDTO = {
      ...dto,
      id,
    };
    this.movements.unshift(newMov);
    return newMov;
  }

  public async getBalance(options?: {
    mode?: 'mes' | 'año';
    month?: number;
    year?: number;
    rubro?: RubroType;
  }): Promise<FinancialBalanceDTO> {
    const mode = options?.mode || 'mes';
    const selectedYear = options?.year || 2026;
    const selectedMonth = options?.month || 8;
    const rubroFilter = options?.rubro;

    const allMovements = await this.getMovements();

    // 12-Month Trend calculation for the selected year
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyTrend = monthNames.map((name, idx) => {
      const mNum = idx + 1;
      const mStr = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
      const inMonth = allMovements.filter((m) => m.date.startsWith(mStr) && (!rubroFilter || m.rubro === rubroFilter || m.rubro === 'general'));
      const inc = inMonth.filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);
      const exp = inMonth.filter((m) => m.type === 'egreso').reduce((s, m) => s + m.amount, 0);
      return {
        month: name,
        monthIndex: mNum,
        income: Math.round(inc * 100) / 100,
        expenses: Math.round(exp * 100) / 100,
        net: Math.round((inc - exp) * 100) / 100,
      };
    });

    // Filter movements according to mode (mes vs año)
    const targetMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const targetYearPrefix = `${selectedYear}`;

    const filtered = allMovements.filter((m) => {
      const matchPeriod = mode === 'mes' ? m.date.startsWith(targetMonthPrefix) : m.date.startsWith(targetYearPrefix);
      const matchRubro = !rubroFilter || m.rubro === rubroFilter || m.rubro === 'general';
      return matchPeriod && matchRubro;
    });

    let totalIncome = 0;
    let totalExpenses = 0;

    const rubroMap: Record<RubroType, { income: number; expenses: number }> = {
      porcino: { income: 0, expenses: 0 },
      bovino: { income: 0, expenses: 0 },
      avicola: { income: 0, expenses: 0 },
    };

    for (const m of filtered) {
      if (m.type === 'ingreso') {
        totalIncome += m.amount;
        if (m.rubro !== 'general') {
          rubroMap[m.rubro].income += m.amount;
        }
      } else {
        totalExpenses += m.amount;
        if (m.rubro !== 'general') {
          rubroMap[m.rubro].expenses += m.amount;
        }
      }
    }

    const netUtility = Math.round((totalIncome - totalExpenses) * 100) / 100;
    const utilityMarginPercent =
      totalIncome > 0 ? Math.round((netUtility / totalIncome) * 1000) / 10 : 0;

    const byRubro = (['porcino', 'bovino', 'avicola'] as RubroType[]).map((r) => {
      const inc = rubroMap[r].income;
      const exp = rubroMap[r].expenses;
      const util = Math.round((inc - exp) * 100) / 100;
      const margin = inc > 0 ? Math.round((util / inc) * 1000) / 10 : 0;
      return {
        rubro: r,
        income: inc,
        expenses: exp,
        utility: util,
        marginPercent: margin,
      };
    });

    const periodLabel = mode === 'mes' ? `${monthNames[selectedMonth - 1]} ${selectedYear}` : `Año ${selectedYear}`;

    return {
      period: periodLabel,
      mode,
      selectedMonth,
      selectedYear,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netUtility,
      utilityMarginPercent,
      monthlyTrend,
      byRubro,
    };
  }
}

export const financialService = new FinancialService();
