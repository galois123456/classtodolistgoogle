export function calendarWeek(year, month, weekStart = 'monday') {
  const start = weekStart === 'sunday' ? 0 : 1;
  return {
    offset: (new Date(year, month, 1).getDay() - start + 7) % 7,
    weekdays: Array.from({ length: 7 }, (_, index) => (start + index) % 7)
  };
}
