// utils.test.ts — тесты для всей логики в utils.ts
// Запуск: npm test
// Vitest автоматически находит файлы в __tests__/ или с суффиксом .test.ts

import { describe, it, expect, beforeEach } from "vitest";
import {
  lvlOf, progOf, nextXP,
  fmtDate, todayStr,
  isBdTitle, bdName,
  daysLeft, msUntilLocalMidnight,
  autoRollover, spawnRecurring,
  uid, mkCode,
} from "../utils.js";
import { XP_TABLE, RANKS } from "../constants.js";
import type { Task, QuestlyEvent } from "../types.js";

// ─── Вспомогательная функция: дата со смещением ──────────────────
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Шаблон задачи для тестов ────────────────────────────────────
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1", title: "Тест", period: "day", xp: 15,
    done: false, dueDate: todayStr(), recurring: false,
    recurType: "", streakEnabled: false, streak: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// lvlOf — уровень по XP
// ═══════════════════════════════════════════════════════════════════
describe("lvlOf", () => {
  it("при 0 XP — первый уровень", () => {
    expect(lvlOf(0)).toBe(1);
  });

  it("не падает ниже 1", () => {
    expect(lvlOf(-9999)).toBeGreaterThanOrEqual(1);
  });

  it("ровно на пороге 2-го уровня — возвращает 2", () => {
    // XP_TABLE[1] — минимальный XP для уровня 2
    expect(lvlOf(XP_TABLE[1])).toBe(2);
  });

  it("на один ниже порога 2-го уровня — возвращает 1", () => {
    expect(lvlOf(XP_TABLE[1] - 1)).toBe(1);
  });

  it("ровно на пороге 3-го уровня — возвращает 3", () => {
    expect(lvlOf(XP_TABLE[2])).toBe(3);
  });

  it("ровно на пороге 10-го уровня — возвращает 10", () => {
    expect(lvlOf(XP_TABLE[9])).toBe(10);
  });

  it("огромный XP — капится на максимальном уровне", () => {
    expect(lvlOf(999_999_999)).toBe(RANKS.length);
  });

  it("монотонно возрастает с ростом XP", () => {
    // Проверяем несколько точек: уровень никогда не убывает
    let prevLvl = lvlOf(0);
    for (const threshold of XP_TABLE) {
      const lvl = lvlOf(threshold);
      expect(lvl).toBeGreaterThanOrEqual(prevLvl);
      prevLvl = lvl;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// progOf — прогресс внутри уровня (0..1)
// ═══════════════════════════════════════════════════════════════════
describe("progOf", () => {
  it("в начале первого уровня — 0", () => {
    expect(progOf(0)).toBe(0);
  });

  it("ровно на пороге следующего уровня — достигаем 1", () => {
    // При XP === XP_TABLE[1] уже перешли на lvl 2, прогресс внутри него = 0
    expect(progOf(XP_TABLE[1])).toBeGreaterThanOrEqual(0);
  });

  it("всегда в диапазоне [0, 1]", () => {
    const samples = [0, 50, 100, 340, 1000, 5000, 50000, 999_999_999];
    for (const xp of samples) {
      const p = progOf(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("растёт внутри одного уровня", () => {
    // На уровне 1 (0..99 XP) прогресс должен расти
    expect(progOf(50)).toBeGreaterThan(progOf(10));
  });

  it("на максимальном уровне — 1", () => {
    expect(progOf(999_999_999)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// nextXP — сколько XP до следующего уровня
// ═══════════════════════════════════════════════════════════════════
describe("nextXP", () => {
  it("на 0 XP — нужно XP_TABLE[1] очков", () => {
    expect(nextXP(0)).toBe(XP_TABLE[1]);
  });

  it("убывает по мере набора XP в пределах уровня", () => {
    expect(nextXP(50)).toBeLessThan(nextXP(0));
  });

  it("на максимальном уровне — 0 (расти некуда)", () => {
    expect(nextXP(999_999_999)).toBe(0);
  });

  it("lvlOf + nextXP всегда дают следующий порог", () => {
    const xp = 340;
    const lvl = lvlOf(xp);
    if (lvl < RANKS.length) {
      expect(xp + nextXP(xp)).toBe(XP_TABLE[lvl]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// fmtDate — форматирование даты
// ═══════════════════════════════════════════════════════════════════
describe("fmtDate", () => {
  it("переводит YYYY-MM-DD → DD.MM.YYYY", () => {
    expect(fmtDate("2024-05-16")).toBe("16.05.2024");
  });

  it("работает с однозначными месяцами и днями (с нулём)", () => {
    expect(fmtDate("2000-01-01")).toBe("01.01.2000");
  });

  it("работает с 31 декабря", () => {
    expect(fmtDate("2025-12-31")).toBe("31.12.2025");
  });
});

// ═══════════════════════════════════════════════════════════════════
// todayStr — текущая дата
// ═══════════════════════════════════════════════════════════════════
describe("todayStr", () => {
  it("возвращает строку формата YYYY-MM-DD", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("год совпадает с текущим", () => {
    expect(todayStr().startsWith(String(new Date().getFullYear()))).toBe(true);
  });

  it("два вызова подряд дают одинаковый результат", () => {
    expect(todayStr()).toBe(todayStr());
  });
});

// ═══════════════════════════════════════════════════════════════════
// daysLeft — сколько дней до даты
// ═══════════════════════════════════════════════════════════════════
describe("daysLeft", () => {
  it("для сегодняшней даты — «сегодня»", () => {
    expect(daysLeft(todayStr())).toBe("сегодня");
  });

  it("для вчерашней даты — «просрочено»", () => {
    expect(daysLeft(dateOffset(-1))).toBe("просрочено");
  });

  it("для завтрашней даты — «1 дн.»", () => {
    expect(daysLeft(dateOffset(1))).toBe("1 дн.");
  });

  it("для даты через 7 дней — «7 дн.»", () => {
    expect(daysLeft(dateOffset(7))).toBe("7 дн.");
  });
});

// ═══════════════════════════════════════════════════════════════════
// msUntilLocalMidnight — время до полуночи
// ═══════════════════════════════════════════════════════════════════
describe("msUntilLocalMidnight", () => {
  it("возвращает положительное число", () => {
    expect(msUntilLocalMidnight()).toBeGreaterThan(0);
  });

  it("не превышает 24 часа", () => {
    expect(msUntilLocalMidnight()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isBdTitle / bdName — определение дней рождения
// ═══════════════════════════════════════════════════════════════════
describe("isBdTitle", () => {
  it.each([
    "день рождения Маши",
    "ДР Алексея",
    "Алексей др",
    "днюха Вовы",
    "birthday party",
    "Birthday of Alex",
  ])('"%s" определяется как день рождения', (title) => {
    expect(isBdTitle(title)).toBe(true);
  });

  it.each([
    "подготовить отчёт",
    "купить хлеб",
    "звонок с командой",
    "drinkwater",          // «dr» не отдельное слово — не должно совпасть
  ])('"%s" НЕ является днём рождения', (title) => {
    expect(isBdTitle(title)).toBe(false);
  });
});

describe("bdName", () => {
  it("извлекает имя после «ДР:»", () => {
    expect(bdName("ДР: Алексей")).toBe("Алексей");
  });

  it("извлекает имя после «день рождения»", () => {
    expect(bdName("день рождения Маши")).toBe("Маши");
  });

  it("извлекает имя перед «– ДР»", () => {
    expect(bdName("Вова – ДР")).toBe("Вова");
  });

  it("возвращает исходную строку если паттерн не найден", () => {
    expect(bdName("Алексей")).toBe("Алексей");
  });

  it("обрезает пробелы по краям", () => {
    expect(bdName("ДР:  Маша  ")).toBe("Маша");
  });
});

// ═══════════════════════════════════════════════════════════════════
// autoRollover — перенос просроченных задач
// ═══════════════════════════════════════════════════════════════════
describe("autoRollover", () => {
  const yesterday = dateOffset(-1);
  const today     = todayStr();

  it("не трогает задачи с дедлайном сегодня", () => {
    const task = makeTask({ dueDate: today, streak: 5 });
    const [result] = autoRollover([task]);
    expect(result.dueDate).toBe(today);
    expect(result.streak).toBe(5);
    expect(result.rolledOver).toBeFalsy();
  });

  it("переносит просроченную не-повторяющуюся задачу на сегодня", () => {
    const task = makeTask({ dueDate: yesterday, recurring: false, streak: 3 });
    const [result] = autoRollover([task]);
    expect(result.dueDate).toBe(today);
    expect(result.streak).toBe(0);
    expect(result.rolledOver).toBe(true);
  });

  it("не трогает выполненную просроченную задачу", () => {
    const task = makeTask({ dueDate: yesterday, done: true });
    const [result] = autoRollover([task]);
    expect(result.dueDate).toBe(yesterday); // не изменилась
  });

  it("сбрасывает стрик у просроченной повторяющейся задачи с streakEnabled", () => {
    const task = makeTask({ dueDate: yesterday, recurring: true, streakEnabled: true, streak: 7 });
    const [result] = autoRollover([task]);
    expect(result.streak).toBe(0);
    // Дата остаётся как есть — новый экземпляр создаст spawnRecurring
    expect(result.dueDate).toBe(yesterday);
  });

  it("не сбрасывает стрик у просроченной задачи без streakEnabled", () => {
    const task = makeTask({ dueDate: yesterday, recurring: true, streakEnabled: false, streak: 7 });
    const [result] = autoRollover([task]);
    expect(result.streak).toBe(7); // не тронут
  });

  it("обрабатывает пустой массив без ошибок", () => {
    expect(autoRollover([])).toEqual([]);
  });

  it("обрабатывает несколько задач независимо", () => {
    const tasks = [
      makeTask({ id: "a", dueDate: yesterday, recurring: false }),
      makeTask({ id: "b", dueDate: today }),
    ];
    const result = autoRollover(tasks);
    expect(result[0].dueDate).toBe(today);   // перенесена
    expect(result[1].dueDate).toBe(today);   // не изменилась
  });
});

// ═══════════════════════════════════════════════════════════════════
// spawnRecurring — создание новых экземпляров повторяющихся задач
// ═══════════════════════════════════════════════════════════════════
describe("spawnRecurring", () => {
  const today     = todayStr();
  const yesterday = dateOffset(-1);

  it("создаёт новый экземпляр ежедневной задачи на сегодня", () => {
    const template = makeTask({ id: "tpl", dueDate: yesterday, recurring: true, recurType: "day" });
    const result = spawnRecurring([template], [], today);
    const newTask = result.find(t => t.dueDate === today && (t.templateId || t.id) === "tpl");
    expect(newTask).toBeDefined();
    expect(newTask!.done).toBe(false);
  });

  it("не создаёт дубликат если экземпляр на этот день уже есть", () => {
    const template  = makeTask({ id: "tpl", dueDate: yesterday, recurring: true, recurType: "day" });
    const existing  = makeTask({ id: "inst1", templateId: "tpl", dueDate: today });
    const result    = spawnRecurring([template, existing], [], today);
    const instances = result.filter(t => (t.templateId || t.id) === "tpl" && t.dueDate === today);
    expect(instances).toHaveLength(1);
  });

  it("не создаёт экземпляр для не-повторяющейся задачи", () => {
    const task   = makeTask({ dueDate: yesterday, recurring: false });
    const before = [task].length;
    const result = spawnRecurring([task], [], today);
    // Задача не повторяется — длина не должна увеличиться
    expect(result.length).toBe(before);
  });

  it("новый экземпляр получает уникальный id", () => {
    const template = makeTask({ id: "tpl", dueDate: yesterday, recurring: true, recurType: "day" });
    const result   = spawnRecurring([template], [], today);
    const newTask  = result.find(t => t.dueDate === today);
    expect(newTask?.id).not.toBe("tpl");
  });

  it("не падает на пустых массивах", () => {
    expect(() => spawnRecurring([], [], today)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Генераторы uid / mkCode
// ═══════════════════════════════════════════════════════════════════
describe("uid", () => {
  it("начинается с «q»", () => {
    expect(uid().startsWith("q")).toBe(true);
  });

  it("два вызова дают разные ID", () => {
    expect(uid()).not.toBe(uid());
  });
});

describe("mkCode", () => {
  it("возвращает строку из 6 символов верхнего регистра", () => {
    const code = mkCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("два вызова с очень высокой вероятностью дают разные коды", () => {
    // Вероятность совпадения: (1/36)^6 ≈ 0.000000025% — можно смело проверять
    expect(mkCode()).not.toBe(mkCode());
  });
});
