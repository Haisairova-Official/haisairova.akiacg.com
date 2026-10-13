// Shared activity for all player cars; animation/audio never imply translation.
export function getYarisActivity({car,started,paused,space,speed}) {
  if(!started||paused)return 'stopped';
  if(space)return 'stationary';
  return Math.abs(speed)>.08?'driving':'stopped';
}
