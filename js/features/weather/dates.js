export function formatHour(value) {
  if (typeof value !== 'string') return '--:--';
  // Open-Meteo usa timestamp ISO: qui ci interessa solo la porzione HH:mm.
  const parts = value.split('T');
  return parts[1] ? parts[1].slice(0, 5) : value;
}

export function formatWeekday(value, locale = 'it-IT', weekdayStyle = 'short') {
  if (typeof value !== 'string') return '--';

  // Forziamo mezzanotte per trattare `value` come data locale e non come orario assoluto.
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat(locale, { weekday: weekdayStyle }).format(date);
}
