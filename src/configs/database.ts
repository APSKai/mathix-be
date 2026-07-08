import mongoose from 'mongoose'

const connectDB = async () => {
    const MONGODB_URI: string = process.env.MONGODB_URI || ''

    if (!MONGODB_URI) {
        console.error('Missing MONGODB_URI in .env file')
        process.exit(1)
    }

    try {
        await mongoose.connect(MONGODB_URI)
        console.log('MongoDB Connected Successfully')
    } catch (e) {
        console.error('MongoDB Connected Failure: ' + e)
        process.exit(1)
    }
}

export default connectDB
