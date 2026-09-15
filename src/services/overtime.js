import Holiday from "../models/holiday.js";

// ============================================================
// Configuração do horário comercial
// ============================================================
const WORK_START_HOUR = 9;   // 09:00
const WORK_END_HOUR   = 18;  // 18:00
// Dias úteis: 1=seg, 2=ter, 3=qua, 4=qui, 5=sex
const WORK_DAYS = new Set([1, 2, 3, 4, 5]);

// ============================================================
// Importa feriados do ano via Brasil API (fetch nativo Node 22)
// Fonte: https://brasilapi.com.br/api/feriados/v1/{ano}
// ============================================================
export async function syncHolidays(year) {
  const url = `https://brasilapi.com.br/api/feriados/v1/${year}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Brasil API retornou ${response.status} para o ano ${year}`);
  }

  const data = await response.json();

  for (const item of data) {
    await Holiday.upsert({ date: item.date, name: item.name, year });
  }

  return data.length;
}

// ============================================================
// Garante que os feriados do ano estejam sincronizados
// ============================================================
export async function ensureHolidaysForYear(year) {
  const count = await Holiday.count({ where: { year } });
  if (count === 0) {
    try {
      await syncHolidays(year);
    } catch (e) {
      console.error(`Falha ao sincronizar feriados de ${year}:`, e.message);
    }
  }
}

// ============================================================
// Formata minutos → "HH:MM"
// ============================================================
export function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================================
// Carrega set de datas de feriado para um intervalo de anos
// Retorna Set com strings "YYYY-MM-DD"
// ============================================================
async function loadHolidaySet(startYear, endYear) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const { Op } = await import("sequelize");
  const holidays = await Holiday.findAll({
    where: { year: { [Op.in]: years } },
    attributes: ["date"],
  });

  return new Set(holidays.map((h) => h.date));
}

// ============================================================
// Calcula minutos de hora extra entre dois timestamps
//
// Estratégia: percorre dia a dia (não minuto a minuto),
// calculando o overlap entre o período trabalhado e o
// intervalo fora do horário comercial de cada dia.
// Complexidade: O(dias) com 1 query ao banco — muito rápido.
//
// Regras:
//  - Seg–Sex 09h–18h = horário comercial (NÃO é HE)
//  - Qualquer minuto fora desse intervalo em dia útil = HE
//  - Feriados e fins de semana: 100% do período é HE
// ============================================================
export async function calcOvertimeMinutes(startDate, endDate) {
  if (endDate <= startDate) return 0;

  const startYear = startDate.getFullYear();
  const endYear   = endDate.getFullYear();
  const holidaySet = await loadHolidaySet(startYear, endYear);

  let overtimeMinutes = 0;

  // Início do dia atual sendo processado
  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);

  while (dayStart < endDate) {
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Janela do período trabalhado dentro deste dia
    const periodStart = startDate > dayStart ? startDate : dayStart;
    const periodEnd   = endDate < dayEnd     ? endDate   : dayEnd;

    if (periodStart < periodEnd) {
      const dateStr    = toDateStr(dayStart);
      const dayOfWeek  = dayStart.getDay();
      const isHoliday  = holidaySet.has(dateStr);
      const isWeekend  = !WORK_DAYS.has(dayOfWeek);

      if (isHoliday || isWeekend) {
        // Dia inteiro é HE
        overtimeMinutes += diffMinutes(periodStart, periodEnd);
      } else {
        // Dia útil: soma apenas o que está fora de 09h–18h
        const workStart = new Date(dayStart);
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        const workEnd = new Date(dayStart);
        workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

        // Trecho antes das 09h
        if (periodStart < workStart) {
          const heEnd = periodEnd < workStart ? periodEnd : workStart;
          overtimeMinutes += diffMinutes(periodStart, heEnd);
        }

        // Trecho após as 18h
        if (periodEnd > workEnd) {
          const heStart = periodStart > workEnd ? periodStart : workEnd;
          overtimeMinutes += diffMinutes(heStart, periodEnd);
        }
      }
    }

    // Avança para o próximo dia
    dayStart.setDate(dayStart.getDate() + 1);
  }

  return overtimeMinutes;
}

// ============================================================
// Helpers internos
// ============================================================
function diffMinutes(a, b) {
  return Math.round((b - a) / 60000);
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
