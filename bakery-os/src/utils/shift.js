export function getShift() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}