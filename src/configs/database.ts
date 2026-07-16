import mongoose from 'mongoose'

const connectDB = async () => {
    const MONGODB_URI: string =
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mathix'

    try {
        await mongoose.connect(MONGODB_URI)
        console.log('MongoDB Connected Successfully')
    } catch (e) {
        console.error('MongoDB Connected Failure: ' + e)
        process.exit(1)
    }
}

export const disconnectDB = async () => {
    await mongoose.disconnect()
}

export default connectDB
