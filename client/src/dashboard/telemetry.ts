export interface Telemetry {
  jointAngles: Record<string, number>
  tcp: { x: number; y: number; z: number }
  status: string
}

export const telemetryRef: { current: Telemetry } = {
  current: { jointAngles: {}, tcp: { x: 0, y: 0, z: 0 }, status: 'idle' },
}
