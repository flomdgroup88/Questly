import { useEffect, useRef } from "react";
import { autoRollover, spawnRecurring, today, msUntilMoscowMidnight } from "../utils.js";

/**
 * Хук автоматически переносит незавершённые задачи ровно в 00:00 по Москве.
 *
 * Как работает:
 *  1. При монтировании вычисляет, сколько миллисекунд до следующей полуночи МСК.
 *  2. Ставит setTimeout на это время.
 *  3. В момент срабатывания вызывает autoRollover + spawnRecurring, обновляет tasks.
 *  4. Сразу же планирует следующий перенос через ровно 24 ч (и так каждую ночь).
 *
 * Параметры:
 *  - setTasks   — сеттер из useTasks (стабильная функция, не вызывает лишних эффектов)
 *  - eventsRef  — ref на актуальный массив events (избегаем перезапуска эффекта)
 */
export function useMidnightRollover({ setTasks, eventsRef }) {
  const timerRef = useRef(null);

  useEffect(() => {
    const schedule = () => {
      const ms = msUntilMoscowMidnight();

      timerRef.current = setTimeout(() => {
        // Переносим все незавершённые задачи и порождаем повторяющиеся для нового дня
        setTasks(prev =>
          spawnRecurring(autoRollover(prev), eventsRef.current, today())
        );
        // Планируем следующую полночь (ровно через 24 ч после текущего срабатывания)
        schedule();
      }, ms);
    };

    schedule();

    return () => clearTimeout(timerRef.current);
  }, [setTasks, eventsRef]); // оба стабильны — эффект запускается один раз
}
