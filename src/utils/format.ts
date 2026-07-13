export function firestoreTimestampToISOString(timestamp: any) {
    if (!timestamp) return null

    return new Date(
        timestamp._seconds * 1000 + timestamp._nanoseconds / 1_000_000
    ).toISOString()
}
