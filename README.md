# Pawnsposes Platform - Frontend

A modern React-based frontend for Pawnsposes, providing AI-powered chess game analysis, personalized puzzles, and progress tracking.

## Features

- **User Authentication**: Firebase-based authentication with role-based access
- **Game Analysis**: Integration with multiple chess engines for deep game analysis
- **Personalized Puzzles**: Custom puzzle generation based on user games
- **Progress Tracking**: Comprehensive dashboards and weekly reports
- **Playing Style Detection**: AI-powered analysis of playing patterns
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Modern UI**: Clean interface using shadcn/ui components

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Firebase Authentication** for user management
- **React Router** for navigation
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Firebase project setup

### Installation

1. Clone the repository and navigate to the frontend directory:
```bash
cd pawnsposes-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your Firebase credentials in `.env`:
```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

5. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   └── Navbar.tsx      # Navigation component
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── pages/              # Page components
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   └── DashboardPage.tsx
├── services/           # API and external services
│   ├── api.ts          # Backend API service
│   └── firebase.ts     # Firebase configuration
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   └── cn.ts           # Class name utility
└── App.tsx             # Main application component
```

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## User Roles

The application supports different user roles:

- **Child/Player**: Access to game analysis, puzzles, and personal progress
- **Parent**: View child's progress, reports, and manage account
- **Coach**: Manage multiple students, advanced tools, and bulk operations
- **Admin**: System administration and user management

## API Integration

The frontend is designed to work with a FastAPI backend. Key endpoints include:

- `POST /api/analyze` - Analyze chess games
- `GET /api/games/:username` - Fetch user games
- `POST /api/generate-puzzles/:gameId` - Generate puzzles
- `GET /api/style-profile/:username` - Get playing style analysis
- `GET /api/report/:childId` - Get progress reports

## Authentication Flow

1. Users can register with email/password or Google OAuth
2. Firebase handles authentication and JWT token generation
3. Tokens are stored locally and sent with API requests
4. Role-based routing protects different sections of the app

## Styling

The project uses Tailwind CSS with a custom design system:

- **Primary Colors**: Blue-based palette for main actions
- **Chess Colors**: Custom colors for chess board and pieces
- **Typography**: Inter font family for clean readability
- **Components**: Consistent spacing and styling patterns

## Future Enhancements

- [ ] Chess board integration with react-chessboard
- [ ] Real-time puzzle solving interface
- [ ] Advanced reporting with charts and graphs
- [ ] Mobile app using React Native
- [ ] Offline mode support
- [ ] Social features and tournaments

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript for all new components
3. Ensure responsive design for all new features
4. Add proper error handling and loading states
5. Write meaningful commit messages

## License

This project is part of the Pawnsposes platform and follows the main project's licensing terms.
