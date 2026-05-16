import { useState, useCallback, useRef } from "react";
import { lvlOf } from "../utils.js";

/**
 * Хук управляет состоянием задач, XP и связанными анимациями.
 *
 * Возвращает:
 *  - tasks, setTasks
 *  - xp, setXP
 *  - xpAnim, lvlUpAnim  — для отображения анимаций
 *  - handleToggle, handleSave, handleDelete, handleShopToggle
 */
export function useTasks(initialTasks, initialXP) {
  const [tasks, setTasks] = useState(initialTasks);
  const [xp, setXP] = useState(initialXP);
  const [xpAnim, setXPAnim] = useState(null);
  const [lvlUpAnim, setLvlUp] = useState(false);
  const prevLvlRef = useRef(lvlOf(initialXP));

  // ── Отметить задачу выполненной / снять отметку ───────────────────
  const handleToggle = useCallback((id) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        if (!t.done) {
          // Выполняем задачу
          const newStreak = t.streakEnabled
            ? (t.streak || 0) + 1
            : (t.streak || 0);

          setXP((prevXP) => {
            const newXP = prevXP + t.xp;
            const newLvl = lvlOf(newXP);
            if (newLvl > prevLvlRef.current) {
              setLvlUp(true);
              setTimeout(() => setLvlUp(false), 3000);
              prevLvlRef.current = newLvl;
            }
            return newXP;
          });

          setXPAnim({ amount: t.xp });
          setTimeout(() => setXPAnim(null), 2200);

          return { ...t, done: true, streak: newStreak };
        }

        // Снимаем отметку — XP не уходит в минус, уровень синхронизируем с реальным
        setXP((prevXP) => {
          const newXP = Math.max(0, prevXP - t.xp);
          prevLvlRef.current = lvlOf(newXP);
          return newXP;
        });

        // Показываем анимацию −XP, чтобы пользователь видел списание
        setXPAnim({ amount: t.xp, negative: true });
        setTimeout(() => setXPAnim(null), 2200);

        return {
          ...t,
          done: false,
          streak: t.streakEnabled
            ? Math.max(0, (t.streak || 0) - 1)
            : (t.streak || 0),
        };
      })
    );
  }, []);

  // ── Создать или обновить задачу ───────────────────────────────────
  const handleSave = useCallback((task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [task, ...prev];
      const updated = [...prev];
      updated[idx] = { ...prev[idx], ...task };
      return updated;
    });
  }, []);

  // ── Удалить задачу ────────────────────────────────────────────────
  const handleDelete = useCallback((id) => {
    setTasks((p) => p.filter((t) => t.id !== id));
  }, []);

  // ── Отметить пункт в списке покупок ──────────────────────────────
  const handleShopToggle = useCallback((taskId, itemId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.shopItems) return t;
        return {
          ...t,
          shopItems: t.shopItems.map((it) =>
            it.id === itemId ? { ...it, done: !it.done } : it
          ),
        };
      })
    );
  }, []);

  return {
    tasks,
    setTasks,
    xp,
    setXP,
    xpAnim,
    lvlUpAnim,
    handleToggle,
    handleSave,
    handleDelete,
    handleShopToggle,
  };
}
