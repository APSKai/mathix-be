export const whitelist = [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'https://127.0.0.1:5173',
    'http://localhost:5000',
    'https://localhost:5000',
    'http://127.0.0.1:5000',
    'https://127.0.0.1:5000',
    'http://localhost:4000',
    'https://localhost:4000',
    'http://127.0.0.1:4000',
    'https://127.0.0.1:4000',
    process.env.CLIENT_PUBLIC_URL,
    process.env.ADMIN_PUBLIC_URL,
    process.env.API_PUBLIC_URL,
]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
