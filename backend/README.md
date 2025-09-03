# WebPhone Backend API

Multi-number Twilio WebPhone backend API built with Node.js, Express, and MongoDB.

## Features

- 🔐 JWT Authentication & Authorization
- 📞 Multi-number Twilio integration (Don, Demie, Business lines)
- 💬 SMS messaging support
- 📊 Call history and analytics
- 🔒 Rate limiting and security middleware
- 📝 Comprehensive logging
- 🧪 Complete unit test coverage

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for sessions
- **Authentication**: JWT + bcrypt
- **Communication**: Twilio API
- **Testing**: Jest + Supertest + MongoDB Memory Server
- **Validation**: express-validator + Joi
- **Security**: Helmet, CORS, rate limiting

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB instance
- Redis instance
- Twilio account with phone numbers

### Environment Setup

1. **Clone and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables:**
   ```env
   # Server
   NODE_ENV=development
   PORT=3001
   BASE_URL=http://localhost:3001

   # Database
   MONGODB_URI=mongodb://localhost:27017/webphone
   REDIS_URL=redis://localhost:6379

   # Authentication
   JWT_SECRET=your-super-secret-jwt-key-here
   SESSION_SECRET=your-session-secret-here

   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_NUMBERS_CONFIG={"don":{"number":"+1234567890","label":"Don's Number"},"demie":{"number":"+1234567891","label":"Demie's Number"},"business":{"number":"+1234567892","label":"Business Number"}}

   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

### Development

1. **Start development server:**
   ```bash
   npm run dev
   ```
   Server runs on http://localhost:3001 with auto-reload.

2. **Start production server:**
   ```bash
   npm start
   ```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh JWT token

#### Calls
- `GET /api/calls` - List calls with filtering/pagination
- `GET /api/calls/stats` - Get call statistics
- `GET /api/calls/:id` - Get specific call
- `POST /api/calls` - Make a new call
- `PUT /api/calls/:id` - Update call (notes, tags)
- `DELETE /api/calls/:id` - Delete call record

#### Messages
- `GET /api/messages` - List messages with filtering
- `GET /api/messages/threads` - Get message threads
- `GET /api/messages/:id` - Get specific message
- `POST /api/messages` - Send SMS message
- `PUT /api/messages/:id` - Update message
- `DELETE /api/messages/:id` - Delete message

#### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `DELETE /api/users/account` - Delete account

#### Webhooks
- `POST /webhooks/voice/:twilioNumber` - Twilio voice webhooks
- `POST /webhooks/sms/:twilioNumber` - Twilio SMS webhooks
- `POST /webhooks/status/:twilioNumber` - Twilio status callbacks

### Testing

The backend includes comprehensive unit tests covering:
- Authentication flows
- API endpoints
- Service methods
- Database operations
- Error handling

#### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/__tests__/auth.test.js

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

#### Test Structure

```
src/__tests__/
├── jest.setup.js      # Test configuration & mocks
├── auth.test.js       # Authentication tests
├── calls.test.js      # Calls API tests
└── twilio.test.js     # Twilio service tests
```

#### Test Features

- **In-memory MongoDB** - Isolated test database
- **Mocked external services** - Twilio, Redis
- **Comprehensive coverage** - Routes, services, models
- **Parallel execution** - Fast test runs
- **Clean test data** - Fresh database per test

### Project Structure

```
backend/
├── src/
│   ├── __tests__/         # Unit tests
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   ├── models/            # Mongoose models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── server.js          # Application entry point
├── .env.example           # Environment template
├── .env.test              # Test environment
├── jest.config.js         # Jest configuration
└── package.json           # Dependencies & scripts
```

### Docker Development

The backend is containerized for easy deployment:

```bash
# Build and run with docker-compose
docker-compose up backend

# View logs
docker-compose logs backend
```

### Linting & Code Quality

```bash
# Run ESLint
npm run lint

# Auto-fix linting issues
npm run lint -- --fix
```

### Database Migrations

```bash
# Run database migrations
npm run migrate
```

### Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT and session secrets
3. Configure MongoDB and Redis clusters
4. Set up reverse proxy (nginx)
5. Enable SSL/TLS
6. Configure monitoring and logging

### Health Check

The API includes a health check endpoint:

```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Troubleshooting

#### Common Issues

1. **MongoDB connection failed**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env
   - Verify network connectivity

2. **Redis connection failed**
   - Ensure Redis is running
   - Check REDIS_URL in .env
   - Verify Redis configuration

3. **Twilio API errors**
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
   - Check phone number configuration
   - Ensure webhook URLs are accessible

4. **JWT token errors**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure consistent secret across instances

#### Debugging

Enable debug logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality  
4. Ensure all tests pass
5. Submit a pull request

### License

MIT License - see LICENSE file for details.