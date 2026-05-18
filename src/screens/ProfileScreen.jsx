import { useState, useMemo } from "react";
import { T } from "../theme.js";
import { PERIODS, RANKS, RANK_ICONS } from "../constants.js";
import { lvlOf, progOf, nextXP, today } from "../utils";
import { XPBar } from "../components/ui.jsx";

export default function ProfileScreen({ xp, tasks, events, challenges = [], nickname, onSetNickname, userAvatar, onSetAvatar, syncStatus, onImport, onLogout, notifEnabled, reminderTime, permissionState, notifSaving, onEnableNotif, onDisableNotif, onUpdateReminderTime, isDark, onToggleTheme }) {
  const level=lvlOf(xp), rank=RANKS[Math.min(level-1,RANKS.length-1)];
  const rankIcon=RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)];
  const toNext=nextXP(xp), completed=tasks.filter(t=>t.done).length, total=tasks.length;
  const [editingNick,setEditingNick]=useState(false);
  const [nickDraft,setNickDraft]=useState(nickname||"");
  const [showAvatarPicker,setShowAvatarPicker]=useState(false);
  const PROFILE_AVATARS=["🧙","🦊","🐼","🦁","🐯","🐸","🐧","🦄","🤖","👾","🧸","🦋","🐉","🦅","🐬","🧠"];

  const tgName=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
  const displayName=nickname||tgName||"Герой";

  const saveNick=()=>{onSetNickname(nickDraft.trim());setEditingNick(false);};

  const bestStreak=Math.max(0,...tasks.filter(t=>t.streakEnabled).map(t=>t.streak||0));
  const hasShopTask=tasks.some(t=>t.shopItems&&t.shopItems.length>0);
  const shopItemsDone=tasks.reduce((acc,t)=>acc+(t.shopItems?t.shopItems.filter(i=>i.done).length:0),0);
  const allPeriodsCovered=["day","week","month","year"].every(p=>tasks.some(t=>t.period===p));

  // New achievement vars
  const todayStr=today();
  const todayDayTasks=tasks.filter(t=>t.period==="day"&&t.dueDate===todayStr);
  const perfectDay=todayDayTasks.length>=3&&todayDayTasks.every(t=>t.done);
  const completedOnSunday=tasks.some(t=>(t.doneHistory||[]).some(d=>new Date(d).getDay()===0));
  const activeDays=new Set(tasks.flatMap(t=>t.doneHistory||[])).size;

  // ── Хэштег-категории: синонимы (20+ на тему) ────────────────────
  function matchTag(title, syns) {
    const s = (title || "").toLowerCase().replace(/[#_]/g, " ");
    return syns.some(syn => s.includes(syn));
  }
  const WORK_SYNS   = ["работ","work","ворк","офис","проект","отчёт","отчет","совещани","коллег","клиент","бизнес","карьер","зарплат","собеседовани","дедлайн","презентаци","контракт","партнёр","партнер","переговор","стартап","фриланс","митинг","задани","корпоратив","менеджер","шеф","руководств","поставщик"];
  const TRAVEL_SYNS = ["путешестви","поездк","trip","travel","отпуск","виза","билет","самолёт","самолет","отел","гостиниц","чемодан","заграниц","маршрут","аэропорт","вокзал","экскурси","курорт","путёвк","путевк","турне","рюкзак","хостел","бронировани","паспорт","туризм"];
  const MOVIE_SYNS  = ["фильм","кино","movie","cinema","кинотеатр","мультик","мультфильм","аниме","блокбастер","документалк","netflix","нетфликс","голливуд","сеанс","просмотр","кинчик","режиссёр","режиссер","оскар","триллер","комедия","боевик","мелодрам","ужас","премьер"];
  const SERIES_SYNS = ["сериал","series","серию","серий","эпизод","episode","сезон","season","шоу","show","hbo","disney","амедиатека","стриминг","kinopoisk","кинопоиск","нетфликс","netflix","prime","ivi","okko","смотрим","онлайн-кинотеатр"];
  const HOME_SYNS   = ["уборк","уборку","ремонт","посуд","стирк","пылесос","готовк","готовить","кухн","квартир","хозяйств","починить","поломк","быт","мусор","cleaning","мытьё","мытье","глажк","сантехник","электрик","мебел","окна"];
  const FAMILY_SYNS = ["семь","семей","дети","детей","ребёнок","ребенок","родители","мама","папа","бабушк","дедушк","братья","сёстры","сестр","муж","жен","супруг","family","племянник","свекровь","тёщ","тещ","отец","мать","дочь","сын"];
  const DACHA_SYNS  = ["дача","дачн","огород","грядк","урожай","посадить","посев","полит","теплиц","компост","картошк","клубник","деревн","газон","скосить","трава","огурц","помидор","яблон","вишн","малин","забор","баня","колодец"];
  const CAR_SYNS    = ["машин","авто","тачк","автомобил","мойк","техосмотр","страховк","заправк","гараж","шиномонтаж","масл","колес","вождени","автосервис","права","car","каско","осаго","аккумулятор","тормоза","двигатель","запчаст","диск","кузов"];
  const SOCIAL_SYNS = ["инстаграм","instagram","insta","тикток","tiktok","вконтакте","вк","vk","телеграм","telegram","ютуб","youtube","соцсет","лайк","пост","stories","сторис","reels","подписчик","публикаци","контент","блог","twitch","twitter","твиттер","discord","linkedin"];
  const SPORT_SYNS  = ["спорт","тренировк","зал","фитнес","gym","fitness","бег","run","плавани","велосипед","йог","yoga","workout","качалк","качать","пробежк","силов","кардио","турник","отжимани","приседани","лыж","сноуборд","футбол","баскетбол","теннис","бокс"];
  const BOOKS_SYNS  = ["книг","книж","читать","чтение","book","reading","литератур","роман","автор","библиотек","страниц","нон-фикшн","бестселлер","биографи","поэзи","стих","аудиокниг"];
  const HEALTH_SYNS = ["здоровь","врач","доктор","больниц","аптек","лекарств","анализ","приём","прием","диета","витамин","health","медицин","клиник","зубной","стоматолог","терапевт","прививк","давлени","температур","процедур","массаж"];

  const tagWork   = tasks.filter(t => t.done && matchTag(t.title, WORK_SYNS)).length;
  const tagTravel = tasks.filter(t => t.done && matchTag(t.title, TRAVEL_SYNS)).length;
  const tagMovie  = tasks.filter(t => t.done && matchTag(t.title, MOVIE_SYNS)).length;
  const tagSeries = tasks.filter(t => t.done && matchTag(t.title, SERIES_SYNS)).length;
  const tagHome   = tasks.filter(t => t.done && matchTag(t.title, HOME_SYNS)).length;
  const tagFamily = tasks.filter(t => t.done && matchTag(t.title, FAMILY_SYNS)).length;
  const tagDacha  = tasks.filter(t => t.done && matchTag(t.title, DACHA_SYNS)).length;
  const tagCar    = tasks.filter(t => t.done && matchTag(t.title, CAR_SYNS)).length;
  const tagSocial = tasks.filter(t => t.done && matchTag(t.title, SOCIAL_SYNS)).length;
  const tagSport  = tasks.filter(t => t.done && matchTag(t.title, SPORT_SYNS)).length;
  const tagBooks  = tasks.filter(t => t.done && matchTag(t.title, BOOKS_SYNS)).length;
  const tagHealth = tasks.filter(t => t.done && matchTag(t.title, HEALTH_SYNS)).length;
  const tagCatsUnlocked = [tagWork,tagTravel,tagMovie,tagSeries,tagHome,tagFamily,tagDacha,tagCar,tagSocial,tagSport,tagBooks,tagHealth].filter(c=>c>=1).length;

  const ACHIEVEMENTS=useMemo(()=>[
    // ── Задачи ──────────────────────────────────────────
    {icon:"⚡",label:"Первый шаг",        desc:"Выполни первую задачу",          done:completed>=1,   cat:"tasks"},
    {icon:"🔥",label:"Пятёрка",           desc:"Выполни 5 задач",                done:completed>=5,   cat:"tasks"},
    {icon:"💪",label:"В ритме",           desc:"Выполни 25 задач",               done:completed>=25,  cat:"tasks"},
    {icon:"💯",label:"Сотня",             desc:"Выполни 100 задач",              done:completed>=100, cat:"tasks"},
    {icon:"🚀",label:"500 и не устал",    desc:"Выполни 500 задач",              done:completed>=500, cat:"tasks"},
    {icon:"🌍",label:"Тысячник",          desc:"Выполни 1000 задач",             done:completed>=1000,cat:"tasks"},
    {icon:"📦",label:"Коллекционер",      desc:"Создай 10 задач",                done:total>=10,      cat:"tasks"},
    {icon:"🗄️",label:"Библиотека задач",  desc:"Создай 50 задач",                done:total>=50,      cat:"tasks"},
    // ── Периоды ─────────────────────────────────────────
    {icon:"👑",label:"Годовой план",      desc:"Добавь цель на год",             done:tasks.some(t=>t.period==="year"),  cat:"period"},
    {icon:"🌊",label:"Недельный игрок",   desc:"Добавь еженедельную цель",       done:tasks.some(t=>t.period==="week"),  cat:"period"},
    {icon:"💫",label:"Месяц вперёд",      desc:"Добавь ежемесячную цель",        done:tasks.some(t=>t.period==="month"), cat:"period"},
    {icon:"🌠",label:"Мечтатель",         desc:"Добавь мечту",                   done:tasks.some(t=>t.period==="dream"), cat:"period"},
    {icon:"🗓️",label:"Всё охвачено",      desc:"Цели на все периоды сразу",      done:["day","week","month","year","dream"].every(p=>tasks.some(t=>t.period===p)), cat:"period"},
    // ── Серии ───────────────────────────────────────────
    {icon:"🔥",label:"Неделя без пропуска",desc:"Серия 7 дней подряд",           done:bestStreak>=7,   cat:"streak"},
    {icon:"💪",label:"Железная воля",     desc:"Серия 30 дней подряд",           done:bestStreak>=30,  cat:"streak"},
    {icon:"🏃",label:"Марафонец",         desc:"Серия 100 дней подряд",          done:bestStreak>=100, cat:"streak"},
    {icon:"♾️",label:"Вечный огонь",      desc:"Серия 365 дней подряд",          done:bestStreak>=365, cat:"streak"},
    // ── Уровни ──────────────────────────────────────────
    {icon:"⭐",label:"Нашёл себя",         desc:"Достигни уровня 5",              done:level>=5,  cat:"level"},
    {icon:"🌟",label:"Уже не новичок",     desc:"Достигни уровня 10",             done:level>=10, cat:"level"},
    {icon:"💫",label:"Серьёзный человек",  desc:"Достигни уровня 20",             done:level>=20, cat:"level"},
    {icon:"🔮",label:"Икона квартала",     desc:"Достигни уровня 40",             done:level>=40, cat:"level"},
    {icon:"👑",label:"Легенда приложения", desc:"Достигни уровня 60",             done:level>=60, cat:"level"},
    {icon:"🫵",label:"ТЫ",                desc:"Достигни уровня 80",             done:level>=80, cat:"level"},
    // ── Привычки ────────────────────────────────────────
    {icon:"🔄",label:"Завёл привычку",    desc:"Создай повторяемую задачу",      done:tasks.some(t=>t.recurring), cat:"habit"},
    {icon:"🛒",label:"Шопоголик",         desc:"Создай список покупок",          done:hasShopTask,      cat:"habit"},
    {icon:"🧺",label:"Закупился",         desc:"Отметь 10 покупок",              done:shopItemsDone>=10,cat:"habit"},
    {icon:"📋",label:"Список на неделю",  desc:"Сделай чеклист для недельной задачи", done:tasks.some(t=>t.period==="week"&&t.shopItems?.length>0), cat:"habit"},
    {icon:"🗓️",label:"Чеклист мечты",    desc:"Сделай чеклист для мечты",        done:tasks.some(t=>t.period==="dream"&&t.shopItems?.length>0), cat:"habit"},
    // ── События ─────────────────────────────────────────
    {icon:"🎂",label:"Не забуду",         desc:"Добавь день рождения",           done:events.some(e=>e.isBirthday),   cat:"events"},
    {icon:"📅",label:"Организатор",       desc:"Добавь 5 событий",               done:events.length>=5,               cat:"events"},
    {icon:"🗺️",label:"Путешественник",    desc:"Добавь поездку",                 done:events.some(e=>e.eventType==="trip"), cat:"events"},
    {icon:"⏰",label:"Мастер дедлайнов",  desc:"Добавь дедлайн",                 done:events.some(e=>e.eventType==="deadline"), cat:"events"},
    {icon:"🎉",label:"Праздник!",         desc:"Добавь праздник",                done:events.some(e=>e.eventType==="holiday"), cat:"events"},
    {icon:"📅",label:"Хронист",           desc:"Добавь 20 событий",              done:events.length>=20, cat:"events"},
    // ── Бонусные ────────────────────────────────────────
    {icon:"🌅",label:"Ранняя пташка",     desc:"Выполни задачу в первый день",   done:completed>=1, cat:"bonus"},
    {icon:"🧠",label:"Стратег",           desc:"Цели на неделю, месяц и год одновременно", done:["week","month","year"].every(p=>tasks.some(t=>t.period===p)), cat:"bonus"},
    {icon:"🎯",label:"Снайпер",           desc:"Выполни 10 задач подряд без пропуска", done:bestStreak>=10, cat:"bonus"},
    {icon:"🌈",label:"Многозадачность",   desc:"Задачи во всех 5 периодах",      done:["day","week","month","year","dream"].every(p=>tasks.some(t=>t.period===p)), cat:"bonus"},
    {icon:"💬",label:"Социальный",        desc:"Участвуй в соревновании",        done:challenges.length>0, cat:"bonus"},
    {icon:"🤝",label:"Командный игрок",   desc:"Добавь встречу",                 done:events.some(e=>e.eventType==="meeting"), cat:"events"},
    {icon:"🏥",label:"ЗОЖ",              desc:"Добавь событие здоровья",         done:events.some(e=>e.eventType==="health"), cat:"events"},
    {icon:"📖",label:"Книжный червь",     desc:"Выполни 3 книжных задачи",       done:tasks.filter(t=>t.done&&t.title?.toLowerCase().includes("книг")).length>=1, cat:"bonus"},
    {icon:"🏋️",label:"Спортсмен",        desc:"Выполни 5 спортивных задач",     done:tasks.filter(t=>t.done&&(t.title?.toLowerCase().includes("трен")||t.title?.toLowerCase().includes("спорт")||t.title?.toLowerCase().includes("зал"))).length>=5, cat:"bonus"},
    {icon:"💰",label:"Финансист",         desc:"Создай финансовую задачу",       done:tasks.some(t=>t.title?.toLowerCase().includes("деньг")||t.title?.toLowerCase().includes("бюджет")||t.title?.toLowerCase().includes("инвест")), cat:"bonus"},
    {icon:"✈️",label:"Вечно в пути",      desc:"Добавь 3 поездки",               done:events.filter(e=>e.eventType==="trip").length>=3, cat:"events"},
    {icon:"🎓",label:"Самообразование",   desc:"Учись каждую неделю 4 недели",   done:bestStreak>=28, cat:"bonus"},
    {icon:"🌙",label:"Ночной режим",      desc:"Выполни 50 задач",               done:completed>=50, cat:"tasks"},
    {icon:"🏅",label:"Первая десятка",    desc:"Выполни 10 задач",               done:completed>=10, cat:"tasks"},
    // ── Новые: разнообразные ────────────────────────────────────
    {icon:"🌞",label:"Идеальный день",    desc:"Закрой все дневные задачи (мин. 3)", done:perfectDay, cat:"bonus"},
    {icon:"😴",label:"Воскресный герой",  desc:"Выполни задачу в воскресенье",   done:completedOnSunday, cat:"bonus"},
    {icon:"📆",label:"Активист",          desc:"Выполняй задачи 7 разных дней",  done:activeDays>=7, cat:"bonus"},

    // ── Хэштег: Работа ─────────────────────────────────────────────
    {icon:"💼",label:"Деловой человек",    desc:"Выполни рабочую задачу",                  done:tagWork>=1,  cat:"hashtag"},
    {icon:"📊",label:"Трудяга",            desc:"Закрой 10 рабочих задач",                 done:tagWork>=10, cat:"hashtag"},
    {icon:"🏢",label:"Карьерист",          desc:"Закрой 30 рабочих задач",                 done:tagWork>=30, cat:"hashtag"},
    {icon:"🤵",label:"Топ-менеджер",       desc:"Закрой 100 рабочих задач",                done:tagWork>=100,cat:"hashtag"},

    // ── Хэштег: Путешествия ────────────────────────────────────────
    {icon:"🌍",label:"Первый перелёт",     desc:"Выполни задачу о путешествии",            done:tagTravel>=1,  cat:"hashtag"},
    {icon:"🧳",label:"Бродяга",            desc:"Закрой 10 задач о путешествиях",          done:tagTravel>=10, cat:"hashtag"},
    {icon:"✈️",label:"Вечный странник",    desc:"Закрой 30 задач о путешествиях",          done:tagTravel>=30, cat:"hashtag"},

    // ── Хэштег: Фильмы ────────────────────────────────────────────
    {icon:"🎬",label:"Киноман",            desc:"Посмотри первый фильм по задаче",         done:tagMovie>=1,  cat:"hashtag"},
    {icon:"🍿",label:"Кинокритик",         desc:"Закрой 10 задач о фильмах",              done:tagMovie>=10, cat:"hashtag"},
    {icon:"🎭",label:"Синефил",            desc:"Закрой 30 задач о фильмах",              done:tagMovie>=30, cat:"hashtag"},

    // ── Хэштег: Сериалы ───────────────────────────────────────────
    {icon:"📺",label:"Сериальщик",         desc:"Отметь первый просмотренный сериал",      done:tagSeries>=1,  cat:"hashtag"},
    {icon:"🛋️",label:"Диванный эксперт",   desc:"Закрой 10 сериальных задач",             done:tagSeries>=10, cat:"hashtag"},
    {icon:"🎥",label:"Нетфликс отдыхает",  desc:"Закрой 30 сериальных задач",             done:tagSeries>=30, cat:"hashtag"},

    // ── Хэштег: Домашние дела ─────────────────────────────────────
    {icon:"🧹",label:"Чистюля",            desc:"Выполни домашнее дело",                  done:tagHome>=1,  cat:"hashtag"},
    {icon:"🏠",label:"Хозяйственный",      desc:"Закрой 10 домашних задач",               done:tagHome>=10, cat:"hashtag"},
    {icon:"✨",label:"Идеальный дом",       desc:"Закрой 30 домашних задач",               done:tagHome>=30, cat:"hashtag"},

    // ── Хэштег: Семья ─────────────────────────────────────────────
    {icon:"👨‍👩‍👧",label:"Семьянин",           desc:"Выполни задачу для семьи",               done:tagFamily>=1,  cat:"hashtag"},
    {icon:"❤️",label:"Опора семьи",         desc:"Закрой 10 семейных задач",               done:tagFamily>=10, cat:"hashtag"},
    {icon:"👪",label:"Патриарх",            desc:"Закрой 30 семейных задач",               done:tagFamily>=30, cat:"hashtag"},

    // ── Хэштег: Дача ──────────────────────────────────────────────
    {icon:"🌱",label:"Огородник",           desc:"Выполни задачу на даче",                 done:tagDacha>=1,  cat:"hashtag"},
    {icon:"🥕",label:"Агроном",             desc:"Закрой 10 дачных задач",                 done:tagDacha>=10, cat:"hashtag"},
    {icon:"🌻",label:"Сельский житель",     desc:"Закрой 30 дачных задач",                 done:tagDacha>=30, cat:"hashtag"},

    // ── Хэштег: Авто ──────────────────────────────────────────────
    {icon:"🚗",label:"За рулём",            desc:"Выполни задачу об автомобиле",           done:tagCar>=1,  cat:"hashtag"},
    {icon:"🔧",label:"Автолюбитель",        desc:"Закрой 10 задач об авто",                done:tagCar>=10, cat:"hashtag"},
    {icon:"🏎️",label:"Автомеханик",         desc:"Закрой 30 задач об авто",                done:tagCar>=30, cat:"hashtag"},

    // ── Хэштег: Соцсети ───────────────────────────────────────────
    {icon:"📱",label:"Блогер",              desc:"Выполни задачу о соцсетях",              done:tagSocial>=1,  cat:"hashtag"},
    {icon:"👍",label:"Инфлюенсер",          desc:"Закрой 10 задач о соцсетях",             done:tagSocial>=10, cat:"hashtag"},
    {icon:"🌟",label:"Звезда интернета",    desc:"Закрой 30 задач о соцсетях",             done:tagSocial>=30, cat:"hashtag"},

    // ── Хэштег: Спорт ─────────────────────────────────────────────
    {icon:"🏃",label:"Физкультурник",       desc:"Выполни спортивную задачу",              done:tagSport>=1,  cat:"hashtag"},
    {icon:"💪",label:"Атлет",               desc:"Закрой 10 спортивных задач",             done:tagSport>=10, cat:"hashtag"},
    {icon:"🏆",label:"Чемпион по жизни",    desc:"Закрой 50 спортивных задач",             done:tagSport>=50, cat:"hashtag"},

    // ── Хэштег: Книги ─────────────────────────────────────────────
    {icon:"📚",label:"Читатель",            desc:"Выполни задачу о книгах",                done:tagBooks>=1,  cat:"hashtag"},
    {icon:"📖",label:"Книжный клуб",        desc:"Закрой 10 книжных задач",                done:tagBooks>=10, cat:"hashtag"},
    {icon:"🧠",label:"Интеллектуал",        desc:"Закрой 30 книжных задач",                done:tagBooks>=30, cat:"hashtag"},

    // ── Хэштег: Здоровье ──────────────────────────────────────────
    {icon:"🩺",label:"ЗОЖник",              desc:"Выполни задачу о здоровье",              done:tagHealth>=1,  cat:"hashtag"},
    {icon:"💊",label:"Про своё здоровье",   desc:"Закрой 10 задач о здоровье",             done:tagHealth>=10, cat:"hashtag"},
    {icon:"🏥",label:"Доктор себя",         desc:"Закрой 30 задач о здоровье",             done:tagHealth>=30, cat:"hashtag"},

    // ── Хэштег: Мультикатегории ───────────────────────────────────
    {icon:"🎨",label:"Разносторонний",      desc:"Задачи в 3 разных хэштег-темах",         done:tagCatsUnlocked>=3,  cat:"hashtag"},
    {icon:"🌈",label:"Мастер на все руки",  desc:"Задачи в 6 разных хэштег-темах",         done:tagCatsUnlocked>=6,  cat:"hashtag"},
    {icon:"🦄",label:"Человек-оркестр",     desc:"Задачи во всех 12 хэштег-темах",         done:tagCatsUnlocked>=12, cat:"hashtag"},
    {icon:"🦅",label:"Орёл",             desc:"Серия 14 дней",                  done:bestStreak>=14, cat:"streak"},
    {icon:"🏆",label:"Чемпион",          desc:"Серия 60 дней",                  done:bestStreak>=60, cat:"streak"},
    {icon:"💎",label:"Бриллиант",        desc:"Серия 200 дней",                 done:bestStreak>=200,cat:"streak"},
    {icon:"🧬",label:"ДНК продуктивности",desc:"Серия 500 дней",                done:bestStreak>=500,cat:"streak"},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ],[completed,total,bestStreak,hasShopTask,shopItemsDone,allPeriodsCovered,perfectDay,completedOnSunday,activeDays,level,tasks,events,
     tagWork,tagTravel,tagMovie,tagSeries,tagHome,tagFamily,tagDacha,tagCar,tagSocial,tagSport,tagBooks,tagHealth,tagCatsUnlocked]);

  const VISIBLE_ACHIEVEMENTS = 8;
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [achTab, setAchTab] = useState("all");
  const doneCount=ACHIEVEMENTS.filter(a=>a.done).length;

  const ACH_TABS = [
    {id:"all",     icon:"🏆", label:"Все"},
    {id:"tasks",   icon:"✅", label:"Задачи"},
    {id:"streak",  icon:"🔥", label:"Серии"},
    {id:"level",   icon:"⭐", label:"Уровни"},
    {id:"hashtag", icon:"🏷️", label:"Темы"},
    {id:"events",  icon:"📅", label:"События"},
    {id:"habit",   icon:"🔄", label:"Привычки"},
    {id:"bonus",   icon:"🎁", label:"Бонус"},
  ];

  const filteredAch = achTab === "all" ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a=>a.cat===achTab);


  return (
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px",WebkitOverflowScrolling:"touch"}}>
      {/* Character card */}
      <div style={{background:`linear-gradient(145deg,${T.bg2},${T.bg3})`,border:`1px solid ${T.brd}`,borderRadius:20,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:T.purp+"22",filter:"blur(30px)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-20,left:-20,width:80,height:80,borderRadius:"50%",background:T.gold+"22",filter:"blur(20px)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${T.purpDim},${T.bg3})`,border:`2px solid ${T.purp}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:`0 0 20px ${T.purp}44`}}>{rankIcon}</div>
            <div style={{position:"absolute",bottom:-4,right:-4,width:26,height:26,borderRadius:8,background:T.bg1,border:`1.5px solid ${T.brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{userAvatar||"🧙"}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Уровень {level} / 80</div>
            {editingNick?(
              <div style={{marginTop:4,marginBottom:4}}>
                <input autoFocus value={nickDraft} onChange={e=>setNickDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveNick();if(e.key==="Escape")setEditingNick(false);}}
                  placeholder="Введи ник…" maxLength={24}
                  style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",background:T.bg0,border:`1.5px solid ${T.purp}`,borderRadius:9,color:T.text,fontSize:16,fontWeight:800,outline:"none",colorScheme:"dark",marginBottom:8,display:"block"}}/>
                <div style={{display:"flex",gap:6}}>
                  <div onClick={()=>setEditingNick(false)} style={{flex:1,padding:"7px 0",borderRadius:9,cursor:"pointer",background:T.bg0,border:`1px solid ${T.brd}`,color:T.sub,fontSize:13,fontWeight:600,textAlign:"center"}}>Отмена</div>
                  <div onClick={saveNick} style={{flex:2,padding:"7px 0",borderRadius:9,cursor:"pointer",background:nickDraft.trim()?T.purp:T.bg3,color:nickDraft.trim()?"#fff":T.dim,fontSize:13,fontWeight:700,textAlign:"center",transition:"all 0.15s"}}>Сохранить ✓</div>
                </div>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",overflow:"hidden"}} onClick={()=>{setNickDraft(nickname||"");setEditingNick(true);}}>
                <div style={{fontSize:22,fontWeight:900,color:T.text,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
                <div style={{fontSize:12,color:T.sub,background:T.bg3,border:`1px solid ${T.brd}`,borderRadius:6,padding:"2px 7px",flexShrink:0}}>✏️</div>
              </div>
            )}
            <div style={{fontSize:14,color:T.purpL,fontWeight:600}}>{rank}</div>
            {/* Компактный выбор аватара */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,position:"relative"}}>
              {/* 3 случайных + текущий аватар как превью */}
              {PROFILE_AVATARS.filter(em=>em!==(userAvatar||"🧙")).slice(0,3).map(em=>(
                <div key={em} onClick={()=>onSetAvatar&&onSetAvatar(em)}
                  style={{width:30,height:30,borderRadius:8,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                    background:T.bg0,border:`1.5px solid ${T.brd}`,transition:"all 0.15s"}}>{em}</div>
              ))}
              <div onClick={()=>setShowAvatarPicker(v=>!v)}
                style={{width:30,height:30,borderRadius:8,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                  background:showAvatarPicker?T.purp+"44":T.bg0,border:`1.5px solid ${showAvatarPicker?T.purp:T.brd}`,color:T.sub,fontWeight:700,transition:"all 0.15s"}}>
                {showAvatarPicker?"✕":"···"}
              </div>
              {/* Всплывающее окно со всеми аватарами */}
              {showAvatarPicker&&(
                <div style={{position:"absolute",top:38,left:0,zIndex:50,background:T.bg1,border:`1px solid ${T.purp}66`,borderRadius:14,padding:10,boxShadow:`0 8px 32px #0008`,
                  display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,width:160}}>
                  {PROFILE_AVATARS.map(em=>(
                    <div key={em} onClick={()=>{onSetAvatar&&onSetAvatar(em);setShowAvatarPicker(false);}}
                      style={{width:32,height:32,borderRadius:9,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                        background:(userAvatar||"🧙")===em?T.purp+"44":T.bg0,
                        border:`1.5px solid ${(userAvatar||"🧙")===em?T.purp:T.brd}`,transition:"all 0.15s"}}>{em}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:24,fontWeight:900,color:T.gold,lineHeight:1}}>{xp.toLocaleString()}</div>
            <div style={{fontSize:11,color:T.goldDim}}>очков опыта</div>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,color:T.sub}}>До уровня {level<80?level+1:"MAX"}</span>
            <span style={{fontSize:12,color:T.gold,fontWeight:700}}>{toNext>0?`ещё ${toNext.toLocaleString()} XP`:"Максимум! 👑"}</span>
          </div>
          <XPBar progress={progOf(xp)} color={T.purp} height={10}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Выполнено",     value:completed,                          icon:"✅",color:T.teal},
          {label:"Всего квестов", value:total,                              icon:"📜",color:T.sky},
          {label:"Событий",       value:events.length,                      icon:"📅",color:T.purpL},
          {label:"Лучшая серия",  value:bestStreak>0?`${bestStreak} 🔥`:"—",icon:"🏆",color:"#FF6B35"},
        ].map(s=>(
          <div key={s.label} style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:13,padding:"14px 16px"}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:T.sub,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* By period */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>📊 Выполнено по периодам</div>
        {PERIODS.map(p=>{
          const cnt=tasks.filter(t=>t.period===p.id&&t.done).length;
          const tot=tasks.filter(t=>t.period===p.id).length;
          return (
            <div key={p.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,color:p.accent}}>{p.icon} {p.label}</span>
                <span style={{fontSize:12,color:T.sub}}>{cnt}/{tot}</span>
              </div>
              <XPBar progress={tot>0?cnt/tot:0} color={p.accent} height={5}/>
            </div>
          );
        })}
      </div>

      {/* Achievements */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>🏆 Достижения</div>
          <div style={{fontSize:12,color:T.gold,fontWeight:700}}>{doneCount}/{ACHIEVEMENTS.length}</div>
        </div>
        <XPBar progress={doneCount/ACHIEVEMENTS.length} color={T.gold} height={4}/>
        {/* Category tabs */}
        <div style={{display:"flex",gap:6,overflowX:"auto",marginTop:12,marginBottom:12,paddingBottom:2,scrollbarWidth:"none"}}>
          {ACH_TABS.map(tab=>{
            const tabDone = (tab.id==="all"?ACHIEVEMENTS:ACHIEVEMENTS.filter(a=>a.cat===tab.id)).filter(a=>a.done).length;
            const active = achTab===tab.id;
            return (
              <div key={tab.id} onClick={()=>{setAchTab(tab.id);setShowAllAchievements(false);}}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:20,cursor:"pointer",transition:"all 0.18s",
                  background:active?T.purp:"transparent",
                  border:`1.5px solid ${active?T.purp:T.brd}`,
                  color:active?"#fff":T.sub,fontSize:11,fontWeight:active?700:500}}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tabDone>0&&<span style={{background:active?"#ffffff33":T.purp+"33",color:active?"#fff":T.purpL,borderRadius:8,padding:"1px 5px",fontSize:10,fontWeight:700}}>{tabDone}</span>}
              </div>
            );
          })}
        </div>
        {/* Hashtag category description */}
        {achTab==="hashtag"&&(
          <div style={{background:T.purp+"18",border:`1px solid ${T.purp}44`,borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:11,color:T.purpL,lineHeight:1.5}}>
            🏷️ Ачивки за задачи по темам — работа, путешествия, фильмы и ещё 9 тем. Просто пиши #хэштег или ключевые слова в задаче!
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {(showAllAchievements?filteredAch:filteredAch.slice(0,VISIBLE_ACHIEVEMENTS)).map(a=>({...a,isHashtag:a.cat==="hashtag"})).map(a=>(
            <div key={a.label} style={{background:a.done?(a.isHashtag?T.purp+"22":T.teal+"22"):(a.isHashtag?T.purp+"08":T.bg0),
              border:`1px solid ${a.done?(a.isHashtag?T.purp+"66":T.teal+"66"):(a.isHashtag?T.purp+"22":T.brd)}`,
              borderRadius:11,padding:"12px",transition:"all 0.3s"}}>
              <div style={{fontSize:22,marginBottom:4,filter:a.done?"none":"grayscale(0.8) opacity(0.4)"}}>{a.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:a.done?(a.isHashtag?T.purpL:T.teal):T.sub}}>{a.label}</div>
              <div style={{fontSize:10,color:a.done?(a.isHashtag?T.purp:T.tealDim):T.dim,marginTop:3,lineHeight:1.4}}>{a.desc}</div>
              {!a.done&&<div style={{fontSize:9,color:T.dim,marginTop:4,fontWeight:600,letterSpacing:"0.04em"}}>🔒 не открыто</div>}
              {a.done&&<div style={{fontSize:9,color:a.isHashtag?T.purpL:T.teal,marginTop:4,fontWeight:700,letterSpacing:"0.04em"}}>✓ выполнено</div>}
            </div>
          ))}
          {filteredAch.length > VISIBLE_ACHIEVEMENTS && (
            <div onClick={()=>setShowAllAchievements(v=>!v)} style={{gridColumn:"1/-1",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px",borderRadius:11,cursor:"pointer",background:T.bg0,border:`1px solid ${T.brd}`,marginTop:2}}>
              <span style={{fontSize:12,color:T.purpL,fontWeight:700}}>{showAllAchievements?`▲ Свернуть`:`▼ Показать все (${filteredAch.length})`}</span>
            </div>
          )}
        </div>
      </div>


      {/* ─── Тема ─────────────────────────────────────────── */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"4px",marginBottom:16,display:"flex",gap:4}}>
        {[
          { dark: true,  icon: "🌙", label: "Тёмная"  },
          { dark: false, icon: "☀️", label: "Светлая" },
        ].map(opt => {
          const active = isDark === opt.dark;
          return (
            <div key={String(opt.dark)} onClick={() => !active && onToggleTheme && onToggleTheme()}
              style={{flex:1,padding:"10px 0",borderRadius:10,textAlign:"center",cursor:active?"default":"pointer",
                background:active?T.bg0:"transparent",
                border:`1.5px solid ${active?T.brd:"transparent"}`,
                boxShadow:active?"0 1px 6px #0002":"none",
                transition:"all 0.25s"}}>
              <div style={{fontSize:18,marginBottom:2}}>{opt.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:active?T.text:T.dim}}>{opt.label}</div>
            </div>
          );
        })}
      </div>

      {/* ─── Уведомления ──────────────────────────────────── */}
      <NotificationsBlock
        enabled={notifEnabled}
        reminderTime={reminderTime}
        permissionState={permissionState}
        saving={notifSaving}
        onEnable={onEnableNotif}
        onDisable={onDisableNotif}
        onChangeTime={onUpdateReminderTime}
      />
      {/* ─── Экспорт / Импорт / Облако ─────────────────────── */}
      <DataSafetyBlock
        xp={xp} tasks={tasks} events={events} nickname={nickname}
        syncStatus={syncStatus} onImport={onImport}
      />
      {/* Кнопка выхода — показываем только если onLogout передан (email-пользователи) */}
      {onLogout && (
        <div
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 0", borderRadius: 14, cursor: "pointer", marginBottom: 8,
            background: T.bg1, border: `1px solid ${T.brd}`,
          }}
        >
          <span style={{ fontSize: 16 }}>🚪</span>
          <span style={{ fontSize: 14, color: T.sub, fontWeight: 600 }}>Выйти из аккаунта</span>
        </div>
      )}
      <div style={{height:20}}/>
    </div>
  );
}


// ─── NOTIFICATIONS BLOCK ──────────────────────────────────────────
function NotificationsBlock({ enabled, reminderTime, permissionState, saving, onEnable, onDisable, onChangeTime }) {
  const [localTime, setLocalTime] = useState(reminderTime ?? "09:00");
  const [result,    setResult]    = useState(null); // "ok" | "denied" | "unsupported" | null
  const isSupported = typeof Notification !== "undefined" && "serviceWorker" in navigator;

  const handleToggle = async () => {
    setResult(null);
    if (enabled) {
      await onDisable();
    } else {
      if (!isSupported) { setResult("unsupported"); return; }
      const res = await onEnable(localTime);
      if (res.ok) setResult("ok");
      else if (res.reason === "denied") setResult("denied");
      else setResult("error");
    }
  };

  const handleTimeChange = (e) => {
    setLocalTime(e.target.value);
    if (enabled) onChangeTime(e.target.value);
  };

  const stateColor = enabled ? T.teal : T.sub;
  const stateLabel = enabled ? "Включены" : "Выключены";

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.brd}`, borderRadius: 16, padding: "16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 14 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>🔔</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Напоминания</div>
            <div style={{ fontSize: 12, color: stateColor, marginTop: 1, fontWeight: 600 }}>
              {saving ? "⏳ Сохраняем…" : stateLabel}
            </div>
          </div>
        </div>
        {/* Toggle switch */}
        <div
          onClick={!saving ? handleToggle : undefined}
          style={{
            width: 48, height: 26, borderRadius: 13, cursor: saving ? "default" : "pointer",
            background: enabled ? T.teal : T.bg0,
            border: `1.5px solid ${enabled ? T.teal : T.brd}`,
            position: "relative", transition: "all 0.25s", flexShrink: 0,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <div style={{
            position: "absolute", top: 2,
            left: enabled ? 22 : 2,
            width: 18, height: 18, borderRadius: "50%",
            background: enabled ? "#fff" : T.sub,
            transition: "left 0.25s",
          }}/>
        </div>
      </div>

      {/* Time picker — показывается когда уведомления включены */}
      {enabled && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: T.bg0, borderRadius: 11, border: `1px solid ${T.brd}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Время напоминания</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Ежедневно в выбранное время</div>
            </div>
            <input
              type="time"
              value={localTime}
              onChange={handleTimeChange}
              style={{
                padding: "7px 10px", borderRadius: 9, border: `1px solid ${T.purp}66`,
                background: T.bg1, color: T.text, fontSize: 16, fontWeight: 700,
                outline: "none", colorScheme: "dark", cursor: "pointer",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 8, textAlign: "center" }}>
            Сервер отправит пуш в {localTime} каждый день.
            Убедись, что уведомления разрешены в настройках браузера.
          </div>
        </div>
      )}

      {/* Результат попытки включения */}
      {result === "denied" && (
        <div style={{ marginTop: 10, padding: "9px 12px", background: T.rose + "22", borderRadius: 10, border: `1px solid ${T.rose}44`, fontSize: 12, color: T.rose }}>
          🚫 Браузер заблокировал уведомления. Разреши их вручную в настройках сайта (🔒 в адресной строке).
        </div>
      )}
      {result === "unsupported" && (
        <div style={{ marginTop: 10, padding: "9px 12px", background: T.gold + "22", borderRadius: 10, border: `1px solid ${T.gold}44`, fontSize: 12, color: T.gold }}>
          ⚠️ Пуш-уведомления не поддерживаются в этом браузере. Попробуй Chrome или Edge на компьютере.
        </div>
      )}
      {result === "ok" && (
        <div style={{ marginTop: 10, padding: "9px 12px", background: T.teal + "22", borderRadius: 10, border: `1px solid ${T.teal}44`, fontSize: 12, color: T.teal }}>
          ✓ Отлично! Будем напоминать каждый день в {localTime}.
        </div>
      )}
      {result === "error" && (
        <div style={{ marginTop: 10, padding: "9px 12px", background: T.rose + "22", borderRadius: 10, border: `1px solid ${T.rose}44`, fontSize: 12, color: T.rose }}>
          ⚠️ Не удалось получить FCM-токен. Проверь, что VITE_FIREBASE_VAPID_KEY задан в .env и firebase-messaging-sw.js содержит конфиг проекта.
        </div>
      )}
    </div>
  );
}

// ─── DATA SAFETY BLOCK ────────────────────────────────────────────
function DataSafetyBlock({ xp, tasks, events, nickname, syncStatus, onImport }) {
  const [importErr, setImportErr] = useState("");
  const [importOk,  setImportOk]  = useState(false);

  const handleExport = () => {
    const data = { xp, tasks, events, nickname, _exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `questly-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErr(""); setImportOk(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.tasks || !Array.isArray(data.tasks)) throw new Error("bad format");
        onImport(data);
        setImportOk(true); setTimeout(() => setImportOk(false), 3000);
      } catch { setImportErr("Ошибка: файл повреждён или неверного формата"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const cloudLabel = syncStatus==="saving"?"⏳ Синхронизация…":syncStatus==="saved"?"☁️ Данные в облаке":syncStatus==="error"?"⚠️ Ошибка облака":"☁️ Облачный бэкап";
  const cloudColor = syncStatus==="error"?T.rose:syncStatus==="saved"?T.teal:T.sub;

  return (
    <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>💾 Безопасность данных</div>
      <div style={{fontSize:12,color:T.sub,marginBottom:14,lineHeight:1.5}}>Данные автоматически сохраняются в браузере и в облаке. Для дополнительной защиты — скачайте резервную копию.</div>

      {/* Статус облака */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:T.bg0,borderRadius:11,border:`1px solid ${T.brd}`,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:cloudColor}}>{cloudLabel}</div>
          <div style={{fontSize:11,color:T.dim,marginTop:2}}>{syncStatus==="error"?"Проверь подключение к сети":"Автоматически · каждые 4 сек после изменений"}</div>
        </div>
        <div style={{fontSize:20}}>{syncStatus==="saving"?"⏳":syncStatus==="saved"?"✓":syncStatus==="error"?"✗":"📡"}</div>
      </div>

      {/* Экспорт */}
      <div onClick={handleExport} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:11,cursor:"pointer",background:`linear-gradient(135deg,${T.purp}22,${T.sky}11)`,border:`1px solid ${T.purp}44`,marginBottom:10}}>
        <span style={{fontSize:22}}>📤</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.purpL}}>Скачать резервную копию</div>
          <div style={{fontSize:11,color:T.sub,marginTop:1}}>{tasks.length} задач · {events.length} событий · {xp} XP</div>
        </div>
        <span style={{fontSize:12,color:T.purpL,fontWeight:700}}>JSON</span>
      </div>

      {/* Импорт */}
      <label style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:11,cursor:"pointer",background:T.bg0,border:`1px solid ${T.brd}`}}>
        <input type="file" accept=".json" onChange={handleFileChange} style={{display:"none"}}/>
        <span style={{fontSize:22}}>📥</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>Восстановить из файла</div>
          <div style={{fontSize:11,color:T.sub,marginTop:1}}>Выбери ранее скачанный .json</div>
        </div>
        <span style={{fontSize:12,color:T.teal,fontWeight:700,background:T.teal+"22",padding:"3px 8px",borderRadius:6}}>Выбрать</span>
      </label>

      {importOk  && <div style={{marginTop:8,fontSize:12,color:T.teal,fontWeight:700,textAlign:"center"}}>✓ Данные восстановлены!</div>}
      {importErr && <div style={{marginTop:8,fontSize:12,color:T.rose,textAlign:"center"}}>{importErr}</div>}
    </div>
  );
}
