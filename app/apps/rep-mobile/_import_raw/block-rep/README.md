# Block Rep - Sales Territory Management App

Block Rep is a comprehensive React Native mobile application designed for sales representatives to manage door-to-door canvassing, follow-ups, and territory optimization. Built with modern technologies and best practices for performance, offline support, and scalability.

## 🚀 Features

### Core Functionality
- **Interactive Map**: Google-style map interface with Mapbox for cluster visualization
- **Route Optimization**: Smart walking routes with reordering capabilities
- **Contact Management**: Complete CRM functionality for door-to-door sales
- **Contract Signing**: In-app contract generation with digital signatures
- **Follow-up System**: Automated scheduling and reminders
- **Real-time Communication**: SMS integration via Twilio
- **Performance Analytics**: Gamification with XP, streaks, and leaderboards

### Technical Features
- **Offline Support**: Full offline capability with background sync
- **Real-time Location**: GPS tracking while clocked in
- **Push Notifications**: Follow-up reminders and message alerts
- **Background Operations**: Location tracking and sync in background
- **Security**: Row-level security and proper authentication
- **Performance**: Optimized for 10k+ properties with LOD rendering

## 🛠 Technology Stack

### Frontend
- **React Native 0.73.2** with TypeScript
- **Mapbox Maps** for mapping and offline packs
- **Zustand** for state management
- **React Navigation** for routing
- **React Native Elements** for UI components

### Backend
- **Supabase** for backend services
  - PostgreSQL database
  - Authentication
  - Realtime subscriptions
  - Edge Functions
  - Storage for photos and contracts
- **Twilio** for SMS messaging
- **Firebase** for push notifications

### Development Tools
- **TypeScript** for type safety
- **ESLint** and **Prettier** for code quality
- **Metro** for bundling

## 📱 App Architecture

### Navigation Structure
```
App
├── LoginScreen
└── MainTabs
    ├── MapScreen (Default)
    ├── RouteScreen
    ├── FollowUpsScreen
    └── StatsScreen
└── Stack Screens
    ├── HouseDetailScreen
    ├── ContractScreen
    └── ProfileScreen
```

### Data Models
- **Organizations**: Company/team management
- **Profiles**: User profiles with role-based access
- **Reps**: Sales rep information and goals
- **Clusters**: Geographic territories
- **Properties**: Individual addresses to visit
- **Interactions**: Visit outcomes and notes
- **Sales**: Completed sales records
- **Follow-ups**: Scheduled follow-up appointments
- **Messages**: SMS conversation history

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Xcode (for iOS development)
- Android Studio (for Android development)
- Supabase account
- Mapbox account
- Twilio account

### 1. Clone and Setup
```bash
git clone <repository-url>
cd block-rep/app
npm install
```

### 2. Environment Configuration
Create `.env` file in the `app` directory:
```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Mapbox
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

# Twilio (for Edge Functions)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# App
APP_ENV=development

# iOS Bundle ID
IOS_BUNDLE_ID=com.blockrep.app
```

### 3. iOS Setup
```bash
cd ios
pod install
# Open BlockRep.xcworkspace in Xcode
# Configure signing and capabilities
```

### 4. Android Setup
```bash
# Android setup is mostly automatic
# Ensure Android SDK is properly configured
```

### 5. Run the App
```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## 🗄 Supabase Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down the project URL and API keys

### 2. Database Schema
Run the schema SQL files in order:

```bash
# Connect to your Supabase project
supabase db connect

# Run schema
psql -h your-db-host -U postgres -d postgres -f supabase/schema.sql

# Run RLS policies
psql -h your-db-host -U postgres -d postgres -f supabase/rls_policies.sql

# Seed sample data (optional)
psql -h your-db-host -U postgres -d postgres -f supabase/seed.sql
```

### 3. Edge Functions
Deploy the Edge Functions:

```bash
# Deploy all functions
supabase functions deploy send-sms
supabase functions deploy receive-sms
supabase functions deploy location-update

# Set environment variables
supabase secrets set TWILIO_ACCOUNT_SID=your_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_PHONE_NUMBER=your_number
```

### 4. Twilio Configuration
1. Set up Twilio webhook:
   - Go to Twilio Console > Phone Numbers
   - Set webhook URL to: `https://your-project.supabase.co/functions/v1/receive-sms`
2. Configure messaging service

### 5. Authentication Setup
1. Enable Email/Password authentication in Supabase Dashboard
2. Configure email templates
3. Set up email provider (SMTP settings)

## 📊 Sample Data

The seed script creates a complete demo environment:

### Organization
- **Demo Sales Corp** with 1 manager and 2 reps

### Reps
- **Mike Wilson** - Mission District (8 properties)
- **Lisa Davis** - Nob Hill (6 properties)

### Sample Interactions
- Interested leads
- Completed sales
- Follow-up appointments

## 🏗 Development Guide

### Project Structure
```
block-rep/
├── app/                    # React Native application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── screens/        # Screen components
│   │   ├── services/       # API and external services
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utility functions
│   │   └── hooks/          # Custom React hooks
│   ├── ios/               # iOS native code
│   ├── android/           # Android native code
│   └── package.json
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge Functions
│   ├── schema.sql         # Database schema
│   ├── rls_policies.sql   # Row Level Security
│   └── seed.sql           # Sample data
└── docs/                  # Documentation
```

### Key Components

#### ClockInButton
Manages rep clock-in/out status and background location tracking.

#### SyncIndicator
Shows offline sync status and pending changes.

#### ClusterInfoSheet
Bottom sheet displaying cluster statistics and route start button.

### Services

#### LocationService
Handles GPS tracking, background location, and cluster detection.

#### OfflineSyncService
Manages offline queue and background synchronization.

#### TwilioService
SMS messaging integration.

#### NotificationService
Push notification handling.

## 🔧 Configuration

### Mapbox Configuration
1. Create Mapbox account
2. Generate access token
3. Configure map style to match Google Maps
4. Set up offline map packs

### iOS Permissions
Add to `Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show your position on the map and optimize routes</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location for background tracking while you're working</string>
<key>NSCameraUsageDescription</key>
<string>We need camera access to take photos of properties</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to attach photos to visits</string>
```

### Android Permissions
Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## 🚀 Deployment

### TestFlight Deployment (iOS)
1. Configure app signing in Xcode
2. Archive the app: Product > Archive
3. Upload to App Store Connect
4. Configure TestFlight settings
5. Add testers and distribute

### Production Deployment
1. Configure production Supabase project
2. Set up production Twilio number
3. Build release version
4. Submit to App Store
5. Configure app store listing

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Login functionality
- [ ] Map rendering and cluster selection
- [ ] Route creation and navigation
- [ ] House detail logging
- [ ] Contract signing
- [ ] SMS messaging
- [ ] Offline functionality
- [ ] Background location tracking
- [ ] Push notifications
- [ ] Data synchronization

## 📈 Performance Optimization

### Map Performance
- Level-of-detail (LOD) rendering
- Viewport-based property loading
- Cluster aggregation at low zoom levels
- Efficient layer management

### Offline Optimization
- Local database with SQLite/AsyncStorage
- Compressed image storage
- Background sync queuing
- Conflict resolution

### Memory Management
- Image caching and cleanup
- Component unmounting
- State cleanup
- Background task management

## 🔒 Security Considerations

### Data Protection
- Row-level security on all tables
- API key management
- Secure storage of sensitive data
- JWT token validation

### Privacy
- Location tracking only when clocked in
- Customer data protection
- GDPR compliance ready
- Data retention policies

## 🐛 Troubleshooting

### Common Issues

#### Map not loading
- Check Mapbox access token
- Verify network connectivity
- Check API quotas

#### Location tracking not working
- Verify permissions
- Check iOS background modes
- Validate location services settings

#### Offline sync not working
- Check network detection
- Verify queue processing
- Check storage permissions

#### Push notifications not arriving
- Verify Firebase configuration
- Check device permissions
- Validate token registration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section

## 📚 Additional Resources

- [React Native Documentation](https://reactnative.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Mapbox Documentation](https://docs.mapbox.com/)
- [Twilio Documentation](https://www.twilio.com/docs)
- [React Navigation Documentation](https://reactnavigation.org/)

---

Built with ❤️ by the Block Rep team