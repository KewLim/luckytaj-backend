# LuckyTaj Backend API

Backend API server for LuckyTaj gaming platform admin panel and frontend services.

## 🚀 Features

- **Admin Panel API**: Complete CRUD operations for games, winners, comments, videos
- **OTP Authentication**: Firebase-based phone verification
- **User Metrics**: Track user interactions and engagement
- **File Uploads**: Handle banner and game image uploads
- **Database Integration**: MongoDB with Mongoose ODM
- **Security**: JWT authentication, rate limiting, CORS protection

## 📋 Prerequisites

- Node.js (v16+)
- MongoDB (local or cloud)
- Firebase project with Authentication enabled

## 🛠 Installation

```bash
npm install
```

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3003
MONGODB_URI=mongodb://localhost:27017/luckytaj-admin
JWT_SECRET=your-jwt-secret-key
NODE_ENV=production
```

## 🏃‍♂️ Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Admin registration

### Games Management
- `GET /api/games` - Get all games (admin)
- `GET /api/games/public` - Get active games (public)
- `POST /api/games` - Create new game
- `PUT /api/games/:id` - Update game
- `DELETE /api/games/:id` - Delete game

### Winners Management
- `GET /api/winners` - Get all winners
- `POST /api/winners` - Add new winner
- `PUT /api/winners/:id` - Update winner
- `DELETE /api/winners/:id` - Delete winner

### Comments Management
- `GET /api/comments` - Get all comments
- `POST /api/comments` - Add new comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

### Jackpot Messages
- `GET /api/jackpot` - Get jackpot messages (admin)
- `GET /api/jackpot/active` - Get active messages (public)
- `POST /api/jackpot` - Create jackpot message
- `PUT /api/jackpot/:id` - Update jackpot message
- `DELETE /api/jackpot/:id` - Delete jackpot message

### OTP & Authentication
- `POST /api/otp/request` - Request OTP
- `POST /api/otp/log` - Log OTP verification
- `GET /api/otp/logs` - Get OTP logs (admin)
- `GET /api/otp/stats` - Get OTP statistics

### Metrics & Analytics
- `GET /api/metrics` - Get user interaction metrics
- `POST /api/metrics/interaction` - Log user interaction
- `POST /api/metrics/link-phone` - Link phone to tip ID

### File Uploads
- `POST /api/banners` - Upload banner images
- `POST /api/video` - Upload video content

## 🗄️ Database Models

- **Admin** - Admin user accounts
- **Game** - Game configurations
- **Winner** - Winner announcements
- **Comment** - User comments
- **JackpotMessage** - Jackpot predictions
- **UserInteraction** - User engagement metrics
- **Video** - Video content management
- **Banner** - Banner advertisements

## 🔐 Security Features

- JWT token authentication
- Rate limiting on sensitive endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization
- File upload restrictions

## 🚀 Deployment

This backend is ready for deployment on:
- **Render.com** (recommended)
- **Heroku**
- **Railway**
- **DigitalOcean App Platform**

### Render.com Deployment

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy with build command: `npm install`
4. Start command: `npm start`

## 📊 Monitoring

- Server logs are available in `server.log`
- OTP requests are logged in `otp-logs.json`
- User interactions tracked in MongoDB

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

This project is proprietary software for LuckyTaj gaming platform.