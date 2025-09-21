import express from 'express'; // Import Express framework
import mongoose from 'mongoose'; // Import Mongoose for MongoDB
import cors from 'cors'; // Import CORS middleware
import multer from 'multer'; // Import Multer for file uploads
import path from 'path'; // Import path for file handling
import { fileURLToPath } from 'url'; // Import for ESM path resolution
import jwt from 'jsonwebtoken'; // Import JWT for authentication
import bcrypt from 'bcryptjs'; // Import bcrypt for password hashing
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url); // Get current file path
const __dirname = path.dirname(__filename); // Get directory name

const app = express(); // Initialize Express app
const port = process.env.PORT || 5000; // Define server port
const JWT_SECRET = process.env.JWT_SECRET; // JWT secret (replace with env variable in production)

// Middleware
app.use(cors()); // Enable CORS for frontend requests
app.use(express.json()); // Parse JSON bodies
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files from uploads/
const upload = multer({ dest: 'uploads/' }); // Configure Multer to save files to uploads/

// MongoDB connection
/*mongoose.connect(process.env.MDB_KEY, { // Connect to MongoDB
  useNewUrlParser: true, // Use new URL parser
  useUnifiedTopology: true // Use new topology engine
}).then(() => console.log('MongoDB connected')) // Log success
  .catch(err => console.error('MongoDB connection error:', err)); // Log error*/


let isConnected =false;

async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MDB_KEY, { // Connect to MongoDB
          useNewUrlParser: true, // Use new URL parser
          useUnifiedTopology: true // Use new topology engine
    })
    isConnected=true;
    console.log("MongoDB connected")
  
    
  } catch (error) {
     console.error('MongoDB connection error:', error);
    
  }
  
}


app.use((req,res,next) => {
  if (!isConnected){
    connectToMongoDB()
  }
  next()
})

// User Schema
const userSchema = new mongoose.Schema({ // Define schema for users
  email: { type: String, required: true, unique: true }, // Email, unique and required
  password: { type: String, required: true }, // Password, required
  createdAt: { type: Date, default: Date.now } // Creation timestamp
});

const User = mongoose.model('User', userSchema); // Create User model

// Influencer Schema
const influencerSchema = new mongoose.Schema({ // Define schema for influencers
  youtubeLink: { type: String, required: true }, // YouTube link, required
  instagramLink: { type: String, required: true }, // Instagram link, required
  accountName: { type: String, required: true }, // Account name, required
  email: { type: String, required: true }, // Email, required
  profileImage: { type: String, required: true }, // Profile image URL, required
  followers: { type: String, required: true }, // Followers count, required
  category: { type: String, required: true }, // Category, required
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
  createdAt: { type: Date, default: Date.now } // Creation timestamp
});

const Influencer = mongoose.model('Influencer', influencerSchema); // Create Influencer model

// Authentication Middleware
const authMiddleware = (req, res, next) => { // Middleware to verify JWT
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from Bearer header
  if (!token) return res.status(401).json({ message: 'No token provided' }); // Check if token exists
  try { // Verify token
    const decoded = jwt.verify(token, JWT_SECRET); // Decode token
    req.userId = decoded.userId; // Attach userId to request
    next(); // Proceed to next middleware
  } catch (err) { // Handle invalid token
    res.status(401).json({ message: 'Invalid token' }); // Return error
  }
};

// User Signup
app.post('/signup', async (req, res) => { // Handle user signup
  try { // Try block
    const { email, password } = req.body; // Destructure request body
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password
    const user = new User({ email, password: hashedPassword }); // Create new user
    await user.save(); // Save to MongoDB
    res.status(201).json({ message: 'User created successfully' }); // Send success
  } catch (err) { // Catch errors
    console.error(err); // Log error
    res.status(400).json({ message: 'Email already exists or invalid data' }); // Send error
  }
});

// User Login
app.post('/login', async (req, res) => { // Handle user login
  try { // Try block
    const { email, password } = req.body; // Destructure request body
    const user = await User.findOne({ email }); // Find user by email
    if (!user) return res.status(400).json({ message: 'User not found' }); // Check if user exists
    const isMatch = await bcrypt.compare(password, user.password); // Compare passwords
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' }); // Check password
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' }); // Generate JWT
    res.status(200).json({ token }); // Send token
  } catch (err) { // Catch errors
    console.error(err); // Log error
    res.status(500).json({ message: 'Server error' }); // Send error
  }
});

// Create Influencer
app.post('/influencers', upload.single('profileImage'), authMiddleware, async (req, res) => { // Handle POST with file upload, protected
  try { // Try block for error handling
    const { youtubeLink, instagramLink, accountName, email, followers, category } = req.body; // Destructure form fields
    const profileImage = req.file ? `/uploads/${req.file.filename}` : ''; // Get file path or empty string

    if (!profileImage) { // Check if image was uploaded
      return res.status(400).json({ message: 'Profile image is required' }); // Return error
    }

    const influencer = new Influencer({ // Create new influencer document
      youtubeLink, // Assign YouTube link
      instagramLink, // Assign Instagram link
      accountName, // Assign account name
      email, // Assign email
      profileImage, // Assign image URL
      followers, // Assign followers
      category, // Assign category
      userId: req.userId // Assign user ID from token
    });

    await influencer.save(); // Save to MongoDB
    res.status(201).json({ message: 'Influencer created successfully' }); // Send success response
  } catch (err) { // Catch errors
    console.error(err); // Log error
    res.status(500).json({ message: 'Server error' }); // Send error response
  }
});

// Get Influencer by User ID
app.get('/influencers/me', authMiddleware, async (req, res) => { // Handle GET for user's influencer profile
  try { // Try block
    const influencer = await Influencer.findOne({ userId: req.userId }); // Find by userId
    if (!influencer) { // Check if found
      return res.status(404).json({ message: 'No influencer profile found' }); // Return error
    }
    res.status(200).json(influencer); // Send influencer data
  } catch (err) { // Catch errors
    console.error(err); // Log error
    res.status(500).json({ message: 'Server error' }); // Send error response
  }
});

app.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ email: user.email });
  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});


//INFLUENCERS PROFILE
app.get('/influencerprofile', async (req, res) => {
  try {
    const influencers = await Influencer.find();
    res.json(influencers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//app.listen(port, () => console.log(`Server running on port ${port}`)); // Start server

export default app
