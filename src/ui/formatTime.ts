export const formatTime = (ms: number) => {
  const seconds = Math.ceil(ms / 1_000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};
