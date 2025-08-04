## CSS Best Practices

- Always split mobile and desktop CSS selectors
- Consider using `display: grid` with `grid-template-columns` for more flexible and responsive layouts instead of `display: flex`

## AI Edge Effects

### AI-Glowing-1 (Pulse Border Effect)

**Call this:** "AI-Glowing-1"

For creating buttons with animated pulsing glowing borders:

```css
.ai-button {
    border: 2px solid #00d4ff;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    animation: glowPulse 2s ease-in-out infinite alternate;
    transition: transform 0.3s ease;
}

@keyframes glowPulse {
    0% {
        box-shadow: 0 0 5px rgba(0, 212, 255, 0.5);
        border-color: #00d4ff;
    }
    100% {
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.8);
        border-color: #5b86e5;
    }
}
```

Key features:
- 2-second pulse cycle with `alternate` direction
- Glow grows from 5px to 20px
- Border color shifts from cyan (#00d4ff) to blue (#5b86e5)
- Always active animation for AI/futuristic feel

### AI-Glowing-2 (Light Sweep Effect)

**Call this:** "AI-Glowing-2"

For elements that need a scanning/sweeping light beam effect:

```css
.ai-generate-section::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transition: left 0.5s;
}

.ai-generate-section:hover::after {
    left: 100%;
}
```

Key features:
- Light beam sweeps from left to right
- Semi-transparent white overlay effect
- Triggered on hover
- Creates scanning/AI processing feel

## Development Workflow

- Make sure you save all the file before you continue to amend everything I told you
- "css push" means: "css updated, git push"

## Server Management

- When I say "start", start/restart the server for admin panel and front end, and diagnose the server connection make sure it Is work.

## API and Integration

- When linking any section of admin panel to front end, ensure the API is perfectly configured to pull live data from the admin-controlled database
- Verify that the admin panel is fully functional before establishing front-end connections

## Render.com Backend Deployment Lessons

### Separation of Concerns is Sacred

- Don't mix frontend and backend in production deployments
- Create dedicated repositories for each service
- Backend should serve APIs, not frontend assets (unless specifically designed as full-stack)

### Route Order Matters More Than You Think

- Static middleware (express.static) catches routes before specific handlers
- Always define specific routes BEFORE catch-all middleware
- The app.use('*', ...) 404 handler is a hungry beast - keep it at the very end

### Environment Variables are Your Lifeline

- MongoDB Atlas requires proper IP whitelisting (use 0.0.0.0/0 for cloud deployments)
- MONGO_URI vs MONGODB_URI - support both to avoid deployment headaches
- Always test locally with production-like environment variables

### File Dependencies Will Bite You

- Don't reference files that don't exist in your deployment repository
- index.html dependencies should be explicit, not assumed
- Static file paths need to match your middleware configuration

### API-First Thinking Wins

- Design your backend as an API service first
- Admin panels are consumers, not the core service
- Health checks (/health) are essential for debugging deployment issues

### The Golden Rule

"A backend deployment is only as strong as its weakest dependency. Test every route, verify every file, and always have a rollback plan."

## Current Session Progress Summary (Aug 3, 2025)

### Database Migration Completed ✅
- Successfully migrated ALL local MongoDB data to MongoDB Atlas
- Connection String: `mongodb+srv://kewlim0:jy5S2mg3LLhChCpk@luckytaj-admin-panel.t6ljpon.mongodb.net/lucky_taj_admin?retryWrites=true&w=majority&appName=luckytaj-admin-panel`
- Data migrated: 9 collections (admins, banners, winners, games, jackpotmessages, gameconfigs, videos, comments, userinteractions)
- Total documents: 6,474 records successfully transferred

### Repository Architecture Issue Identified 🔍
- **Local Repository**: `KewLim/landing-page` (where we've been working)
- **Render.com Deployment**: `KewLim/admin-panel-luckytaj` (different repository!)
- **Solution Applied**: Added admin-panel as remote and force-pushed all changes

### Render.com Deployment Status 🚀
- **URL**: https://admin-panel-luckytaj.onrender.com
- **Current Issue**: Login fails with 500 error due to missing JWT_SECRET environment variable
- **Database Connection**: ✅ Working (MONGODB_URI set correctly)
- **Recent Changes Pushed**: Improved error handling and database diagnostic endpoint

### Required Actions for Tomorrow:
1. **Set JWT_SECRET in Render.com**: Add `JWT_SECRET=your_jwt_secret_key_here_change_in_production` to environment variables
2. **Verify Deployment**: Check if latest changes (diagnostic endpoint, improved auth) are deployed
3. **Test Login**: Confirm admin login works with `admin@luckytaj.com` / `admin123`

### Admin Credentials Confirmed ✅
- **Email**: admin@luckytaj.com
- **Password**: admin123 
- **Database Status**: Admin exists in online MongoDB Atlas with correct password hash
- **Local Test**: Password verification confirmed working

### Technical Details for Reference:
- **Local MongoDB**: `mongodb://localhost:27017/lucky_taj_admin`
- **Online MongoDB**: MongoDB Atlas cluster `luckytaj-admin-panel`
- **Admin Panel Local**: http://localhost:3003/admin
- **Admin Panel Production**: https://admin-panel-luckytaj.onrender.com/admin

### Key Files Modified:
- `server.js`: Added database diagnostic endpoint
- `routes/auth.js`: Improved error handling for login debugging
- `.env`: Contains all necessary environment variables for local development

**Next Session Goal**: Complete the Render.com deployment fix and ensure full admin panel functionality online.