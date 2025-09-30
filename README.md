<<<<<<< HEAD
# Book8 AI

**Scheduling, voice, and web search — wired with a modular workflow engine.**

Book8 AI is a comprehensive appointment scheduling platform that combines traditional booking management with AI-powered integrations. Built with Next.js, MongoDB, and modern UI components, it provides a solid foundation for AI-enhanced scheduling workflows.

## 🚀 Features

### Core Functionality
- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Appointment Management**: Create, view, and cancel bookings with full CRUD operations
- **Real-time Dashboard**: Modern, responsive UI built with Tailwind CSS and Radix UI
- **Secure API**: RESTful API with proper authentication and error handling

### AI Integrations (Stubbed for MVP)
- **Google Calendar Sync**: Calendar integration for automated scheduling
- **OpenAI Realtime Audio**: Voice-based appointment booking
- **Tavily Search**: Web search capabilities for enhanced scheduling
- **Stripe Billing**: Subscription management with webhook support
- **n8n Workflows**: Modular workflow engine integration

### Technical Features
- **MongoDB Integration**: Persistent data storage with proper indexing
- **CORS Support**: Cross-origin resource sharing for API access
- **Health Monitoring**: Built-in health check endpoints
- **Automated Testing**: Comprehensive backend test suite
- **Production Ready**: Optimized for deployment with standalone output

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, MongoDB, JWT Authentication
- **UI Components**: Radix UI, Lucide React Icons
- **Payments**: Stripe Integration
- **Database**: MongoDB with proper indexing
- **Testing**: Python-based automated test suite

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- MongoDB database (local or cloud)
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd book8-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=book8_ai
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # Stripe (Optional - for billing features)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_GROWTH=price_...
   STRIPE_PRICE_ENTERPRISE=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # Application
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   CORS_ORIGINS=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧪 Testing

### Backend Testing
The project includes a comprehensive Python test suite for backend functionality:

```bash
# Make sure the app is running on localhost:3000
python backend_test.py
```

**Test Coverage:**
- Health endpoint verification
- User registration and authentication
- Booking CRUD operations
- Integration stub endpoints
- CORS preflight handling

### Manual Testing
1. **Registration**: Create a new account with email and password
2. **Login**: Sign in with your credentials
3. **Booking Creation**: Schedule appointments with title, customer info, and timing
4. **Booking Management**: View, modify, and cancel appointments
5. **Integration Stubs**: Test AI integration buttons (currently return stub responses)

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Booking Endpoints
- `GET /api/bookings` - List user's bookings
- `POST /api/bookings` - Create new booking
- `PATCH /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Integration Endpoints (Stubbed)
- `POST /api/integrations/google/sync` - Google Calendar sync
- `POST /api/integrations/voice/call` - Voice call integration
- `POST /api/integrations/search` - Web search integration

### Utility Endpoints
- `GET /api/health` - Health check
- `GET /api/user` - Current user profile

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables for Production
Ensure all required environment variables are set:
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET` - Secure JWT secret key
- `NEXT_PUBLIC_BASE_URL` - Your domain URL
- Stripe variables (if using billing features)

## 🏗️ Project Structure

```
book8-ai/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── [[...path]]/   # Dynamic API routing
│   ├── globals.css        # Global styles
│   ├── layout.js          # Root layout
│   └── page.js            # Main application page
├── components/            # Reusable UI components
│   └── ui/               # Radix UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
├── tests/                 # Test files
├── backend_test.py        # Automated test suite
├── test_result.md         # Test results and status
└── package.json           # Dependencies and scripts
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run dev:no-reload` - Development without hot reload

### Key Components
- **Authentication**: JWT-based auth with localStorage persistence
- **Booking Management**: Full CRUD operations with validation
- **UI Components**: Modern, accessible components using Radix UI
- **API Design**: RESTful API with proper error handling and CORS

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the test results in `test_result.md`
- Run the automated test suite to verify functionality
- Review the API documentation above
- Check the browser console for client-side errors

## 🔮 Roadmap

### Phase 1 (Current - MVP)
- ✅ User authentication and authorization
- ✅ Basic appointment scheduling
- ✅ Modern UI with responsive design
- ✅ API foundation with proper error handling

### Phase 2 (Future)
- 🔄 Google Calendar integration
- 🔄 OpenAI Realtime Audio implementation
- 🔄 Tavily search integration
- 🔄 n8n workflow automation
- 🔄 Advanced scheduling features
- 🔄 Multi-user collaboration

---

**Book8 AI** - Where scheduling meets AI intelligence.

*Last updated: January 2025 - SSH signing enabled*
=======
# Book8 AI — MVP

A modern, modular scheduling and AI integration service.

This repository contains the Next.js (App Router) app with MongoDB and a single catch‑all API route. It supports JWT auth, bookings CRUD, and stubs for Google Calendar, OpenAI Realtime Audio, Tavily, Stripe billing, and n8n. Stripe subscriptions (test mode) are implemented with webhooks.

## Quick Links
- App entry: `/` (dashboard)
- Legacy shim: `/account` (redirect info + link to dashboard)
- API root: `/api`

## Environment
Required environment variables (set these in Vercel Project → Settings → Environment Variables):

- `MONGO_URL`
- `DB_NAME`
- `NEXT_PUBLIC_BASE_URL` (e.g. `https://book8-ai.vercel.app`) — used to build absolute success/cancel/return URLs
- `CORS_ORIGINS` (optional, defaults to `*` for MVP)

Stripe (test mode):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_ENTERPRISE`

## Stripe return URLs (environment‑aware)
We centralize base URL resolution in `lib/baseUrl.js`. API routes call this helper using the `Host` header so that return URLs work in production and preview environments.

- Checkout success: `${base}/?success=true&session_id={CHECKOUT_SESSION_ID}`
- Checkout cancel: `${base}/?canceled=true`
- Customer portal return: `${base}/?portal_return=true`

The dashboard shows a small banner when any of these query flags are present.

## Webhook
`POST /api/billing/stripe/webhook` uses `request.text()` to verify the Stripe signature with `STRIPE_WEBHOOK_SECRET` and updates the user’s `subscription` object.

Events handled:
- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_succeeded`
- `customer.subscription.deleted`

## Dev Notes
- All API routes must be called with `/api` prefix (K8s ingress rule).
- MongoDB responses avoid ObjectId by using UUIDs.
- JWT auth via `jsonwebtoken`, passwords with `bcryptjs`.

## Trigger a Vercel build
This repo is designed for Git‑based deploys. Push any change (like this README) to your connected branch to trigger a new deployment.

Example commands:
```
# from the repository root
git add -A
# sign commit if configured (SSH signing recommended)
git commit -S -m "docs: add README and deployment notes"
git push origin main
```

If using a Deploy Hook instead, create a hook for the production branch and `POST` to it. The hook will redeploy the latest commit from Git.

## Roadmap
- Google Calendar OAuth + sync
- Tavily live search integration
- OpenAI Realtime Audio call flows
- n8n workflow templates
- Analytics dashboard (Phase 2)


Note: Test deploy trigger at 2025-09-13T20:41:25Z

Verified commit test at 2025-09-13T20:55:37Z

Deploy test: hook + cancel-sync fixes at 2025-09-16T00:12:17Z

Deploy test (re-add remote) at 2025-09-16T00:13:18Z

## External Cron (cron-job.org)

We recommend using an external scheduler due to Vercel Hobby limitations.

- Endpoint: `GET /api/cron/sync?secret=CRON_SECRET`
- Set `CRON_SECRET` in Vercel Project → Settings → Environment Variables
- Example URL: `https://book8-ai.vercel.app/api/cron/sync?secret=YOUR_SECRET`
- Interval: Every 10 minutes
- Expected response: `{ ok: true, processed: N }`
- Unauthorized (bad secret): HTTP 401

Optional logging (enable observability):
- Set `CRON_LOGS=true` in Vercel env
- Each run is logged to `cron_logs` collection with `{ runId, startedAt, finishedAt, processed, triggeredBy }`

Testing:
- Manually run: `curl -i "https://book8-ai.vercel.app/api/cron/sync?secret=YOUR_SECRET"`
- Should return 200 with `{ ok: true, processed: N }`

## Deployment Test
Testing Vercel deployment with proper git configuration - January 2025
>>>>>>> 87195ff9cba19e80bc2fcf4bee619181aa347613
