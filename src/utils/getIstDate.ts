export function getIstDate() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // +05:30 in ms
  return new Date(now.getTime() + istOffset);
}