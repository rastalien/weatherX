export function formatHour(value) {
  if (typeof value !== 'string') return '--:--';
  // Open-Meteo usa timestamp ISO: qui ci interessa solo la porzione HH:mm.
  const parts = value.split('T');
  return parts[1] ? parts[1].slice(0, 5) : value;
}

export function formatWeekday(value, locale = 'it-IT', weekdayStyle = 'short') {
  if (typeof value !== 'string') return '--';

  // Forziamo mezzanotte per trattare `value` come data locale e non come orario assoluto.
  // Questo evita slittamenti di giorno dovuti al parsing dei timezone quando
  // l'API ci passa una semplice data YYYY-MM-DD.
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat(locale, { weekday: weekdayStyle }).format(date);
}

export function formatUpdatedAt(value, locale = 'it-IT') {
  if (typeof value !== 'string') return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  // La frase cambia in base al giorno: "alle 11:50" oggi,
  // "il 29/04 alle 11:50" quando il dato arriva da una giornata precedente.
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  const isToday = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (isToday) {
    return `alle ${time}`;
  }

  const day = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit'
  }).format(date);

  return `il ${day} alle ${time}`;
}
