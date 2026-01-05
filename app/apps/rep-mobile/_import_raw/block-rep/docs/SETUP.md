# Complete Setup Guide

This comprehensive guide walks you through setting up Block Rep from scratch, including all backend services, mobile app configuration, and development environment setup.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Mobile App Setup](#mobile-app-setup)
4. [Development Environment](#development-environment)
5. [Testing Setup](#testing-setup)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
Before starting, create accounts for:
- [Supabase](https://supabase.com) - Backend services
- [Mapbox](https://mapbox.com) - Mapping services  
- [Twilio](https://twilio.com) - SMS messaging
- [Firebase](https://firebase.google.com/) - Push notifications

### Required Software
- Node.js 18+ with npm
- Git
- Xcode 15+ (iOS development)
- Android Studio (Android development)
- Supabase CLI

### macOS Setup
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Watchman
brew install watchman

# Install Supabase CLI
brew install supabase/tap/supabase
```

### Windows Setup
```bash
# Install Node.js from nodejs.org
# Install Git for Windows
# Install Supabase CLI via npm
npm install -g supabase
```

### Linux Setup
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Supabase CLI
curl -sSL https://get.supabase.com | bash
```

## Backend Setup

### 1. Supabase Project Creation

#### Create New Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: `block-rep-dev`
   - Database Password: Generate strong password
   - Region: Choose closest to your location
4. Wait for project initialization (2-3 minutes)

#### Get Project Details
1. Go to Project Settings
2. Note down:
   - Project URL: `https://[your-project-ref].supabase.co`
   - Anon Key: Found in Settings > API
   - Service Role Key: Found in Settings > API

### 2. Database Schema Setup

#### Connect to Database
```bash
# Get connection string from Supabase Dashboard
# Settings > Database > Connection string
supabase db connect
```

#### Apply Schema
```bash
# Navigate to supabase directory
cd block-rep/supabase

# Apply database schema
psql -h your-db-host -U postgres -d postgres -f schema.sql

# Apply RLS policies
psql -h your-db-host -U postgres -d postgres -f rls_policies.sql
```

#### Seed Sample Data
```bash
# Optional: Add sample data for testing
psql -h your-db-host -U postgres -d postgres -f seed.sql
```

### 3. Authentication Setup

#### Enable Email/Password Auth
1. Go to Authentication > Providers
2. Enable Email provider
3. Configure settings:
   - Enable email confirmations
   - Set password requirements
   - Configure email templates

#### Set Up SMTP (Optional)
1. Go to Authentication > Settings
2. Configure custom SMTP for better email delivery
3. Test email sending

### 4. Storage Setup

#### Create Storage Buckets
1. Go to Storage
2. Create new buckets:
   - `photos` - Property photos
   - `contracts` - Signed contracts
   - `documents` - Other documents

#### Configure Bucket Policies
Set appropriate access levels for each bucket based on RLS policies.

### 5. Edge Functions Setup

#### Deploy Functions
```bash
# Deploy all Edge Functions
supabase functions deploy send-sms
supabase functions deploy receive-sms  
supabase functions deploy location-update

# Set environment variables
supabase secrets set TWILIO_ACCOUNT_SID=your_twilio_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_twilio_token
supabase secrets set TWILIO_PHONE_NUMBER=your_twilio_number
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_ANON_KEY=your_supabase_anon_key
supabase secrets set SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 6. Twilio Setup

#### Create Twilio Account
1. Sign up at [twilio.com](https://twilio.com)
2. Verify your account
3. Get your Account SID and Auth Token

#### Buy Phone Number
1. Go to Phone Numbers > Manage > Buy a number
2. Choose number with SMS capabilities
3. Note down the phone number

#### Configure Webhook
1. Go to Phone Numbers > Manage > Active numbers
2. Click on your number
3. Set webhook URL for incoming messages:
   ```
   https://[your-project-ref].supabase.co/functions/v1/receive-sms
   ```
4. Set HTTP method to POST

### 7. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it `block-rep-dev`
4. Enable Google Analytics (optional)

#### Add iOS App
1. Click iOS icon
2. Enter bundle ID: `com.blockrep.app`
3. Download `GoogleService-Info.plist`
4. Skip CocoaPods step for now

#### Add Android App  
1. Click Android icon
2. Enter package name: `com.blockrep.app`
3. Download `google-services.json`
4. Skip Firebase SDK step for now

#### Configure Cloud Messaging
1. Go to Project Settings > Cloud Messaging
2. For iOS: Upload APNs authentication key
3. For Android: Copy server key for later use

## Mobile App Setup

### 1. Project Setup

#### Clone Repository
```bash
git clone <repository-url>
cd block-rep/app
```

#### Install Dependencies
```bash
npm install
```

#### iOS Specific Setup
```bash
cd ios
pod install
```

### 2. Environment Configuration

#### Create Environment File
Create `.env` in the app directory:
```env
# Supabase
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Mapbox
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Twilio (for Edge Functions)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# App
APP_ENV=development
API_URL=http://localhost:54321

# iOS Bundle ID
IOS_BUNDLE_ID=com.blockrep.app
```

#### Configure React Native Config
Install and configure react-native-config:
```bash
npm install react-native-config
```

### 3. Mapbox Configuration

#### Get Mapbox Access Token
1. Go to [mapbox.com](https://mapbox.com)
2. Create account or sign in
3. Go to Account > Access tokens
4. Create new token with these scopes:
   - `styles:read`
   - `fonts:read`
   - `datasets:read`
   - `vision:read`

#### Configure Map Style
Update map style URL in MapScreen to match Google Maps styling.

### 4. iOS Configuration

#### Update Info.plist
Add required permissions to `ios/BlockRep/Info.plist`:
```xml
<!-- Location permissions -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show your position on the map and optimize routes</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location for background tracking while you're working</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location for background tracking while you're working</string>

<!-- Camera permissions -->
<key>NSCameraUsageDescription</key>
<string>We need camera access to take photos of properties</string>

<!-- Photo library permissions -->
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to attach photos to visits</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>We need to save photos to your library</string>

<!-- Background modes -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
    <string>remote-notification</string>
</array>

<!-- Firebase configuration -->
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

#### Add Firebase Configuration
1. Copy `GoogleService-Info.plist` to `ios/` directory
2. Add to Xcode project (right-click > Add Files)

#### Configure Signing
1. Open `ios/BlockRep.xcworkspace` in Xcode
2. Select BlockRep project
3. Go to Signing & Capabilities
4. Select your team and configure signing

### 5. Android Configuration

#### Update AndroidManifest.xml
Add permissions to `android/app/src/main/AndroidManifest.xml`:
```xml
<!-- Location permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Camera permissions -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Storage permissions -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Network permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Background permissions -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Add inside <application> tag -->
<service android:name="com.transistorsoft.locationmanager.service.TrackingService" />
<service android:name="com.transistorsoft.locationmanager.service.LocationRequestService" />
```

#### Add Firebase Configuration
1. Copy `google-services.json` to `android/app/` directory
2. Add Firebase plugin to `android/build.gradle`:
```gradle
classpath 'com.google.gms:google-services:4.3.15'
```

3. Apply plugin in `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

#### Configure Signing
1. Generate signing key:
```bash
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

2. Place in `android/app/` directory

## Development Environment

### 1. Metro Configuration

#### Start Development Server
```bash
# Start Metro bundler
npm start

# Start with reset cache
npm start -- --reset-cache
```

### 2. Running on Device

#### iOS Simulator
```bash
npx react-native run-ios
```

#### iOS Device
```bash
# Connect device via USB
npx react-native run-ios --device "Your Device Name"
```

#### Android Emulator
```bash
# Start emulator first
npx react-native run-android
```

#### Android Device
```bash
# Enable USB debugging
# Connect device via USB
npx react-native run-android
```

### 3. Debugging Tools

#### React Native Debugger
```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Open with app running
open -a "React Native Debugger"
```

#### Flipper (Facebook's debugging tool)
```bash
# Install Flipper
brew install --cask flipper
```

#### Chrome DevTools
```bash
# Shake device or press Cmd+D (iOS) / Cmd+M (Android)
# Select "Debug JS Remotely"
# Open Chrome DevTools
```

### 4. Code Quality Tools

#### ESLint
```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

#### Prettier
```bash
# Format code
npm run prettier

# Check formatting
npm run prettier:check
```

#### TypeScript
```bash
# Type checking
npx tsc --noEmit
```

## Testing Setup

### 1. Unit Testing

#### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

### 2. Integration Testing

#### Detox Setup (E2E)
```bash
# Install Detox CLI
npm install -g detox-cli

# Build test app
detox build

# Run tests
detox test
```

### 3. Manual Testing Checklist

#### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset flow
- [ ] Session persistence

#### Map Functionality
- [ ] Map loads correctly
- [ ] Clusters display properly
- [ ] Property pins show at correct zoom
- [ ] Location tracking works
- [ ] Cluster selection shows info sheet

#### Route Management
- [ ] Route creation from cluster
- [ ] Route reordering
- [ ] Navigation between stops
- [ ] Route completion

#### House Interactions
- [ ] All outcome types work
- [ ] Photo capture and upload
- [ ] Notes saving
- [ ] Customer info collection
- [ ] Contract signing

#### Follow-ups
- [ ] Follow-up scheduling
- [ ] SMS messaging
- [ ] Call functionality
- [ ] Completion marking

#### Offline Mode
- [ ] Data caching
- [ ] Offline interaction logging
- [ ] Sync when online
- [ ] Conflict resolution

#### Performance
- [ ] App startup time < 3 seconds
- [ ] Map panning is smooth
- [ ] No memory leaks
- [ ] Battery usage reasonable

## Troubleshooting

### Common Issues

#### Metro Bundler Issues
```bash
# Clear Metro cache
npm start -- --reset-cache

# Clear watchman cache
watchman watch-del-all

# Clear npm cache
npm cache clean --force
```

#### iOS Build Issues
```bash
# Clean build folder
cd ios
xcodebuild clean

# Clear derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reinstall pods
pod deintegrate
pod install
```

#### Android Build Issues
```bash
# Clean build
./gradlew clean

# Clear gradle cache
./gradlew --refresh-dependencies

# Clear build cache
rm -rf android/app/build
```

#### Mapbox Issues
- Ensure Mapbox access token is valid
- Check token has correct scopes
- Verify map style URL is accessible

#### Location Issues
- Verify permissions in device settings
- Check location services enabled
- Ensure background modes configured

#### Supabase Connection Issues
- Verify environment variables
- Check network connectivity
- Ensure RLS policies allow access

### Getting Help

#### Check Logs
```bash
# iOS logs
npx react-native log-ios

# Android logs
npx react-native log-android
```

#### Debug Network Requests
- Use React Native Debugger Network tab
- Monitor Supabase dashboard logs
- Check Edge Functions logs

#### Performance Profiling
```bash
# Profile iOS
npx react-native run-ios --configuration Release

# Profile Android
npx react-native run-android --variant=release
```

## Next Steps

After completing setup:
1. Review the [README.md](../README.md) for app overview
2. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment guide
3. Run the app and test basic functionality
4. Explore the codebase structure
5. Set up your development workflow

## Support

If you encounter issues not covered in this guide:
1. Check the troubleshooting section
2. Review logs for error messages
3. Search existing issues
4. Create new issue with detailed information