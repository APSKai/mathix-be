import Redis from 'ioredis'

let redisClient: Redis | null = null
let connectPromise: Promise<Redis | null> | null = null
let hasLoggedDisabled = false

export const isRedisEnabled = (): boolean => {
    return process.env.REDIS_ENABLED !== 'false'
}

export const getRedisKeyPrefix = (): string => {
    return process.env.REDIS_KEY_PREFIX || 'mathix:api'
}

export const getRedisClient = (): Redis | null => {
    if (!isRedisEnabled()) {
        if (!hasLoggedDisabled) {
            console.warn('[redis] disabled by REDIS_ENABLED=false')
            hasLoggedDisabled = true
        }
        return null
    }

    if (redisClient) return redisClient

    redisClient = process.env.REDIS_URL
        ? new Redis(process.env.REDIS_URL, getRedisOptions())
        : new Redis({
              ...getRedisOptions(),
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
              db: Number(process.env.REDIS_DB) || 0,
          })

    redisClient.on('error', (error) => {
        console.warn(`[redis] ${error.message}`)
    })

    return redisClient
}

export const getReadyRedisClient = async (): Promise<Redis | null> => {
    const client = getRedisClient()
    if (!client) return null
    if (client.status === 'ready') return client
    if (client.status === 'connecting' || client.status === 'connect') {
        return client
    }

    connectPromise ||= client
        .connect()
        .then(() => client)
        .catch((error) => {
            console.warn(`[redis] connect failed: ${error.message}`)
            return null
        })
        .finally(() => {
            connectPromise = null
        })

    return connectPromise
}

const getRedisOptions = () => ({
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 500,
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times: number) {
        if (times > 3) return null
        return Math.min(times * 200, 1000)
    },
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
})
