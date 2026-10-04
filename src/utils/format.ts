

export const formatNumber = (value: number) => Number(value).toLocaleString('en-US');

export const formatTime = (value: string | number) =>
  new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
