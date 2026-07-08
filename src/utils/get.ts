export const getEnvNumber = (key: string, fallback: number): number => {
    const parsed = Number(process.env[key])
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
